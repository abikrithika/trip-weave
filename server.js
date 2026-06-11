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