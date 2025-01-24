const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = 5000;

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


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
