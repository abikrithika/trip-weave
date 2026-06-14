# trip-weave

## Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Git

Verify installation:

node -v
npm -v
git --version

## Installation

### 1. Clone the repository

git clone https://github.com/abikrithika/trip-weave.git
cd trip-weave

### 2. Install dependencies

npm install

### 3. Install Nodemon

npm install --save-dev nodemon

## Environment Variables

Create a `.env` file in the project root.

Example:

PORT=5000
Add any additional environment variables required by the application.

## Package Scripts

Add the following scripts to `package.json`:

"scripts": {
"dev": "nodemon api/src/server.js",
"start": "node api/src/server.js"
}

## Running the Project

### Development Mode (Nodemon)

npm run dev

Nodemon automatically restarts the server whenever changes are made.

### Production Mode

npm start

## API Base URL

When running locally:

http://localhost:5000 (Replace the port if configured differently in `.env`).

## Tech Stack

- Node.js
- Express.js
- PostgresSql
- Nodemon

## Contributors
