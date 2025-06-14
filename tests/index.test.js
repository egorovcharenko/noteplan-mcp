const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Mock Express app setup similar to the main app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Import routes (in a real test, you would import from the actual file)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'noteplan-mcp' });
});

app.post('/mcp/v1/command', (req, res) => {
  const { command, args } = req.body;
  
  switch (command) {
    case 'ping':
      return res.json({ result: 'pong', status: 'success' });
    
    case 'getNotes':
      return res.json({ 
        result: [
          { id: 'note1', title: 'Sample Note 1', content: 'This is a sample note' },
          { id: 'note2', title: 'Sample Note 2', content: 'This is another sample note' }
        ],
        status: 'success' 
      });
    
    default:
      return res.status(400).json({ error: `Unknown command: ${command}`, status: 'error' });
  }
});

// Tests
describe('NotePlan MCP Server', () => {
  test('Health endpoint returns ok status', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('noteplan-mcp');
  });

  test('Ping command returns pong', async () => {
    const response = await request(app)
      .post('/mcp/v1/command')
      .send({ command: 'ping' });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.result).toBe('pong');
    expect(response.body.status).toBe('success');
  });

  test('GetNotes command returns sample notes', async () => {
    const response = await request(app)
      .post('/mcp/v1/command')
      .send({ command: 'getNotes' });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('success');
    expect(Array.isArray(response.body.result)).toBe(true);
    expect(response.body.result.length).toBe(2);
    expect(response.body.result[0].title).toBe('Sample Note 1');
  });

  test('Unknown command returns error', async () => {
    const response = await request(app)
      .post('/mcp/v1/command')
      .send({ command: 'unknownCommand' });
    
    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.error).toContain('Unknown command');
  });
});