import { randomUUID } from 'crypto'
import express from 'express'
const app = express()

app.post('/api/results', (req, res) => {
  
})

app.get('/api/results/:id', (req, res) => {
  const result = previousResults.get(req.params.id)
  if (!result) {
    return res.status(404).json({ error: 'Result not found' })
  }
  res.json(result)
})
