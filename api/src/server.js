// 1. Import the tools we installed
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 2. Set up the Express application
const app = express();

// 3. Middlewares (Rules for the server)
app.use(cors()); // Allows our future frontend to talk to this backend
app.use(express.json()); // Allows the server to understand JSON data
app.use(express.static(path.join(__dirname, '..', '..')));

function pickDestination(text) {
    const cleaned = text.replace(/[^a-zA-Z\s]/g, ' ').trim();
    const match = cleaned.match(/(?:to|in|for)\s+([a-zA-Z\s]{2,})/i);
    if (!match) {
        return 'your destination';
    }

    return match[1]
        .trim()
        .split(' ')
        .filter(Boolean)
        .slice(0, 3)
        .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function buildOffers(destination) {
    const route = `New York -> ${destination}`;
    return [
        {
            route,
            airline: 'SkyBridge Air',
            price: '$470',
            duration: '8h 15m',
            stops: '1 stop',
            cabin: 'Economy'
        },
        {
            route,
            airline: 'Atlas Wings',
            price: '$590',
            duration: '7h 10m',
            stops: 'Non-stop',
            cabin: 'Premium Economy'
        },
        {
            route,
            airline: 'Northline Airways',
            price: '$840',
            duration: '7h 05m',
            stops: 'Non-stop',
            cabin: 'Business'
        }
    ];
}

app.post('/api/assistant', (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) {
        return res.status(400).json({
            reply: 'Please share where and when you want to travel so I can help.',
            offers: []
        });
    }

    const destination = pickDestination(message);
    const offers = buildOffers(destination);
    const reply = `Great choice. I found sample options for ${destination}. Tell me your dates or budget and I can refine them.`;

    return res.json({ reply, offers });
});

// 4. A simple test route to make sure the server works
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ success: true, message: 'TripWeave API is healthy.' });
});

// 5. Central Error Handling Middleware 
// If anything breaks in the code, it will safely fall into this function
app.use((err, req, res, next) => {
    console.error(err.stack); // Prints the error in the terminal for us to see
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server!'
    });
});

// 6. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});