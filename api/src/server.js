// 1. Import the tools we installed
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 2. Set up the Express application
const app = express();

// 3. Middlewares (Rules for the server)
app.use(cors()); // Allows our future frontend to talk to this backend
app.use(express.json()); // Allows the server to understand JSON data

// 4. A simple test route to make sure the server works
app.get('/', (req, res) => {
    res.send('Welcome to the TripWeave API! The server is running.');
});

// 5a. AI Extraction Test Endpoint (Phase 2: AI Prompt Prep)
const { generateText } = require('ai');
const { groq } = require('@ai-sdk/groq');

app.post('/api/test-extraction', async (req, res) => {
    try {
        const userMessage = req.body.message || 'I want to go to Barcelona from Copenhagen for under 2000 DKK next month';
        
        const result = await generateText({
            model: groq('llama-3.1-8b-instant'),
            system: `Extract flight search parameters from user input. Return ONLY valid JSON with these fields:
{
  "origin": "IATA code (e.g., CPH)",
  "destination": "IATA code (e.g., BCN)",
  "departure_date": "YYYY-MM-DD or null",
  "return_date": "YYYY-MM-DD or null",
  "max_budget_dkk": number or null,
  "travelers": number or null,
  "note": "Any other relevant constraints"
}`,
            prompt: userMessage
        });
        
        // Try to parse the response as JSON
        let extractedData;
        try {
            extractedData = JSON.parse(result.text);
        } catch (parseError) {
            // If not valid JSON, return raw text
            extractedData = { raw_response: result.text, error: 'Could not parse as JSON' };
        }
        
        res.json({ 
            success: true, 
            user_input: userMessage,
            extracted: extractedData 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 6. Central Error Handling Middleware 
// If anything breaks in the code, it will safely fall into this function
app.use((err, req, res, next) => {
    console.error(err.stack); // Prints the error in the terminal for us to see
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server!'
    });
});

// 7. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});