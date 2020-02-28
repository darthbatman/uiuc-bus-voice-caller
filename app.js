const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())
const freeclimbSDK = require('@freeclimb/sdk')
const request = require('request');

var host = 'http://9f47e7cd.ngrok.io'
var port = 8080

const accountId = "ACCOUNT_ID"
const authToken = "AUTH_TOKEN"
const freeclimb = freeclimbSDK(accountId, authToken)

var stop = '';

app.get('/grammarFile', function (req, res) {
  const file = `${__dirname}/stopGrammar.xml`
  res.download(file)
})

app.post('/incomingCall', (req, res) => {
	const say = freeclimb.percl.say('Welcome to UIUC Bus Please say your name, then press one or hangup.')
	const options = {
		playBeep: true,
		finishOnKey: '1'
	}
	const record = freeclimb.percl.recordUtterance(`${host}/saidName`, options)
	const percl = freeclimb.percl.build(say, record)
	res.status(200).json(percl)
})

app.post('/saidName', (req, res) => {
	const recordingResponse = req.body
	const say = freeclimb.percl.say('Hi ')
	const play = freeclimb.percl.play(recordingResponse.recordingUrl)
	const stopPrompt = freeclimb.percl.say('What stop do you want to hear about? Say library or transit.')
	const options = {
		grammarType: freeclimb.enums.grammarType.URL,
		prompts: [stopPrompt]
	}
	const getSpeech = freeclimb.percl.getSpeech(`${host}/stopSayDone`, `${host}/grammarFile`, options)
	const percl = freeclimb.percl.build(say, play, getSpeech)
	res.status(200).json(percl)
})

app.post('/stopSayDone', (req, res) => {
	const getSpeechActionResponse = req.body
	stop = 'undefined';
	if (getSpeechActionResponse.reason === freeclimb.enums.getSpeechReason.RECOGNITION) {
		stop = getSpeechActionResponse.recognitionResult
	}
  	const greeting = freeclimb.percl.say(`You selected ${stop}.`)
	const greetingPause = freeclimb.percl.pause(100)
	const promptForColor = freeclimb.percl.say(`Please select a bus Enter one for silver, two for illini, and three for green.`)
	const options = {
		prompts: freeclimb.percl.build(promptForColor),
		maxDigits: 1,
		minDigits: 1,
		flushBuffer: true
	}
	const getDigits = freeclimb.percl.getDigits(`${host}/routeSelectionDone`, options)
	const percl = freeclimb.percl.build(greeting, greetingPause, getDigits)
	res.status(200).json(percl)
})

app.post('/routeSelectionDone', (req, res) => {
	const getDigitResponse = req.body
	const digits = getDigitResponse.digits
	if (digits){
		buses = {
			'1': 'silver',
			'2': 'illini',
			'3': 'green'
		}
		const bus = buses[digits]
		let sayResponse = bus ? `You selected ${bus}.` : 'you did not select a number between 1 and 3. '
		request('CUMTD_REQUEST_URL', function (error, response, body) {
		   const minutes = JSON.parse(body).departures[1]['expected_mins'];
		   const busInformation = `The ${bus} is arriving at ${stop} in ${minutes} minutes.`
			const say = freeclimb.percl.say(`${sayResponse} ${busInformation}`)
			const options = {
				grammarType: freeclimb.enums.grammarType.URL,
				prompts: [say]
			}
			const hangup = freeclimb.percl.hangup()
			const percl = freeclimb.percl.build(say, hangup)
			res.status(200).json(percl)
		});
	}
})

app.listen(port);