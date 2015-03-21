/*
 main.js
 Part of "Intel Edison IoT remote parameters monitor"
 Copyright 2015 Biagio Sesta, Algol Team
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 

Steps for installing MRAA & UPM Library on Intel IoT Platform with IoTDevKit Linux* image
Using a ssh client: 
1. echo "src maa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/intel-iotdk.conf
2. opkg update
3. opkg upgrade

USAGE: ****************
go to http://<edison_address>:1377/sensors

*/
var fs = require('fs');
var http = require('http');
var dispatcher = require('httpdispatcher');
var bind = require('bind');
var PORT = 1377;


var mraa = require("mraa");

//Button connected to D2 connector
    var buttonDigitalPinD2 = new mraa.Gpio(2);
    buttonDigitalPinD2.dir(mraa.DIR_IN);

//Lcd library
var LCD  = require ('jsupm_i2clcd');
var myLCD = new LCD.Jhd1313m1(0, 0x3E, 0x62);

var colorRed = {R: 255, G: 0, B: 0};
var colorBlue = {R: 0,G: 0,B: 255};
var colorWhite = {R: 40,G: 40,B: 40};

//light sensors parameters
//GROVE Kit A0 Connector --> Aio(0)
var myAnalogLightPin = new mraa.Aio(0);

//air quality sensors parameters
//GROVE Kit A3 Connector --> Aio(3)
var myAnalogAirPin = new mraa.Aio(3);

//Temperature sensor parameters
//GROVE Kit A1 Connector --> Aio(1)
var myAnalogPin = new mraa.Aio(1);
var B = 3975;

/*
Function: getSensorsValues()
Description: Read values from sensors and return them as an array
*/
function getSensorsValues() {
    'use strict';
    //setInterval(function () {
        var ambientValues = {}; 
        ambientValues.temp = getTemperature();
        ambientValues.light = getLight();
        ambientValues.airQuality = getAirQuality();
        
    return ambientValues;
    //}, 4000);
}

console.log("Sample Reading Grove Kit Temperature Sensor");

/*
Function: getTemperature()
Description: Read values from temperature sensor and return it
*/
function getTemperature(){
 
    var a = myAnalogPin.read();
        console.log("Analog Pin (A1) Output: " + a);
        //console.log("Checking....");
        
        var resistance = (1023 - a) * 10000 / a; //get the resistance of the sensor;
        //console.log("Resistance: "+resistance);
        var celsius_temperature = 1 / (Math.log(resistance / 10000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;

        console.log("Celsius Temperature: " + celsius_temperature);
    //return celsius temperature with 2 decimal digits
    return celsius_temperature.toFixed(2);
}

/*
Function: getLight()
Description: Read values from light sensor and return it
*/
function getLight(){
    var light = myAnalogLightPin.read();
    return light;
}

/*
Function: getAirQuality()
Description: Read values from air quality sensor and return it
*/
function getAirQuality(){
    var airQuality = myAnalogAirPin.read();
    return airQuality;
}

/*
Function: printToLcd()
Parameters: ambientValues array of sensor values
Description: write the values to LCD connected to the board
*/
function printToLcd(ambientValues){
    myLCD.clear();
    var outputColor = {};
    //cold
    if (ambientValues.temp < 15)
        outputColor=colorBlue;
    //warm
    else if (ambientValues.temp >= 15 && ambientValues.temp <30)
        outputColor=colorWhite;
    //hot
    else
        outputColor=colorRed;
    
    myLCD.setColor(outputColor.R, outputColor.G, outputColor.B);
    //console.log("Temp: " + ambientValues.temp);
    myLCD.write("Temp:" + ambientValues.temp);
    myLCD.setCursor(1,0);
    myLCD.write("Air:" + ambientValues.airQuality);
    myLCD.write(" Lux:" + ambientValues.light);
    
}

/*
Function: handleRequest()
Parameters: request, the http request. response, the http resposne
Description: function that handles the request from a web browser
*/
function handleRequest(request, response){
    try {
        //log the request on console
        console.log(request.url);
        //Disptach
        dispatcher.dispatch(request, response);
    } catch(err) {
        console.log(err);
    }
}

/*
Function: onGet()
Parameters: path to dispatch, callback function that handles the response
Description: function that handles the request from a web browser
*/
dispatcher.onGet("/sensors", function(req, res, chain) {
	var ambientValues = getSensorsValues();
    printToLcd(ambientValues);

	/*next step is a workaround to use node.js template feature with Intel XDK
	if I start main.js typing node main.js, the application binds the template correctly
	if I load main.js with built in feature of XDK, the application does not find sensors.tpl in relative path but it needs absolute path
	*/
	var tpl = "sensors.tpl";
	//check if the application find the tamplate in relative path
	if(!fs.existsSync(tpl))
    	tpl='/home/root/.node_app_slot/sensors.tpl';                     
	bind.toFile(tpl, {
		temperature: ambientValues.temp,
		light: ambientValues.light,
		airQuality: ambientValues.airQuality
	}, function(data) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(data);
	});
	 
}); 


//GROVE Kit Shield D2 --> GPIO2
/*
Function: startButtonWatch()
Description: Check the value of button every 300ms
*/
function startButtonWatch() {
    'use strict';
    var buttonValue = 0, last_b_sensor_value;

    setInterval(function () {
        buttonValue = buttonDigitalPinD2.read();
        if (buttonValue === 1 && last_b_sensor_value === 0) {
            console.log("button pressed");
            var ambientValues = getSensorsValues(); 
            printToLcd(ambientValues);
        } else if (buttonValue === 0 && last_b_sensor_value === 1) {
            console.log("Button released");
        }
        last_b_sensor_value = buttonValue;
    }, 300);
}

//Create a server
var server = http.createServer(handleRequest);
//Lets start our server
server.listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    startButtonWatch();
    console.log("Server listening on: http://localhost:%s", PORT);
});
