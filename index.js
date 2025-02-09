const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const { MessagingResponse } = require('twilio').twiml;
const { Twilio } = require('twilio');
const app = express();
const port = 5000;
// const app = express();
// const port = 5000;

// Set up middleware to parse incoming request data
app.use(bodyParser.urlencoded({ extended: false }));


app.use(bodyParser.json());
app.use(cors());

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

// Endpoint for sending email
app.post('/send-email', async (req, res) => {
    const { recipient, query } = req.body;

    try {
        // Generate email content using OpenAI
        const prompt = `
        You are an AI assistant helping to generate email content. The user query is:
        "${query}"
        Please create:
        1. A professional email subject
        2. A detailed, engaging email body related to the query
        Format your response as:
        Subject: [subject]
        Body: [body]
        `;
        const response = await client.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant helping to generate email content.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            max_tokens: 200,
            temperature: 0.7,
        });

        console.log('OpenAI Response:', response);

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error('No valid response from OpenAI');
        }

        const generatedText = response.choices[0].message.content.trim();
        console.log('Generated Email Content:', generatedText);

        const lines = generatedText.split('\n').map(line => line.trim());

const subject = lines.find((line) => line.startsWith('Subject:'))?.replace('Subject:', '').trim();
let body = lines.find((line) => line.startsWith('Body:'))?.replace('Body:', '').trim();

if (!body) {
    const bodyIndex = lines.findIndex((line) => line.startsWith('Body:'));
    if (bodyIndex >= 0) {
        body = lines.slice(bodyIndex + 1).join('\n').trim();
    }
}

console.log('Extracted Lines:', lines);
// console.log('Extracted Subject:', subject);
// console.log('Extracted Body:', body);


        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: recipient,
            subject,
            text: body,
        };

        console.log('Mail Options:', mailOptions);

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});



// Twilio credentials (replace with your own credentials)
const accountSid = 'AC1dec682dc42c2bc43e92e0bfe0e1b07a';
const authToken = 'd2c1d0476c7480d8d8f17bd3ac82c152';
const newclient = new Twilio(accountSid, authToken);

// In-memory user state
const userState = {};

// POST route for handling messages from Twilio
app.post('/wbot', (req, res) => {
  const inmsg = (req.body.Body || '').trim().toLowerCase();
  const senderNumber = req.body.From;

  const response = new MessagingResponse();
  const msg = response.message();

  if (userState[senderNumber] === 'awaiting_date') {
    msg.body(`Booking confirmed for ${inmsg}.`);
    delete userState[senderNumber];
  } else if (inmsg === 'hello') {
    msg.body("Hello, Welcome to SwasthyaConnect. I am here to help connect you with a doctor for your health concerns.");
    msg.body("Please tell me your symptoms or the issues you are facing today.");
  } else if (inmsg === 'headache') {
    msg.body("Thank you for reaching out, I am here to assist you.");
    msg.body("You mentioned you have a headache.");
    msg.body("How long have you been experiencing the headache?");
    msg.body("Is it mild, moderate or severe?");
    msg.body("Do you have any other symptoms, like nausea or dizziness or fever?");
    msg.body("This will help us find the right doctor for you.");
  } else if (inmsg === 'mild' || inmsg === 'moderate' || inmsg === 'severe') {
    // First response when user sends mild, moderate, or severe
    msg.body("You can contact Dr. R.G. Sharma for an appointment.");

    // Depending on the severity, send the available time slots when the user asks for "appointment"
    userState[senderNumber] = inmsg; // Store the severity (mild, moderate, severe)
  } else if (inmsg === 'appointment') {
    // Check the stored severity and send the appropriate available times
    if (userState[senderNumber] === 'mild') {
      msg.body("He is free on Monday, Wednesday, Friday from 12-3pm. Let us know which time is most suitable for you, and I will book an appointment with him accordingly.");
    } else if (userState[senderNumber] === 'moderate') {
      msg.body("He is free on Tuesday and Wednesday from 11-2pm. Let us know which time is most suitable for you, and I will book an appointment with him accordingly.");
    } else if (userState[senderNumber] === 'severe') {
      msg.body("He is free on Monday, Thursday, Saturday from 3-5pm. Let us know which time is most suitable for you, and I will book an appointment with him accordingly.");
    }
    userState[senderNumber] = 'awaiting_date'; // Now expecting the day from the user
  } else if (inmsg === 'bye') {
    msg.body("Thanks for connecting, I will book that time for you.");
  } else {
    msg.body("I am sorry, I don't understand.");
  }

  res.set('Content-Type', 'text/xml');
  res.send(response.toString());
});


// Start the server
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });



app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
