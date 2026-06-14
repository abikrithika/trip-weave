require('dotenv').config(); // Load .env file

const { generateText } = require('ai');
const { groq } = require('@ai-sdk/groq');

async function testConnection() {
  try {
    console.log('🔄 Testing Groq connection...');
    
    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      prompt: 'Say hello in one sentence'
    });
    
    console.log('✅ Success! Groq responded:');
    console.log(result.text);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testConnection();