const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);

// Define allowed origins
const allowedOrigins = ['http://localhost:8080', 'http://localhost:8081'];

// CORS middleware setup
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "healthcare"
});

// Connect to the database
db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});



// Define allowed origins
const allowedOrigins1 = ['http://localhost:8080', 'http://localhost:8081'];

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins1.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});


// REST API to book appointments
app.post('/book_appointments', (req, res) => {
  const {
    fullName, email, phone, dateOfBirth,
    country, city, disease, medicalHistory,
    appointmentDate
  } = req.body;

  const query = `
    INSERT INTO appointment (fullName, email, phone, dateOfBirth, country, city, disease, medicalHistory, appointmentDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [fullName, email, phone, dateOfBirth, country, city, disease, medicalHistory, appointmentDate], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const appointment = { id: result.insertId, ...req.body, status: 'pending' };

    // Emit the new appointment to all connected clients (doctor UI)
    io.emit('new_appointment', appointment);

    res.status(200).json(appointment);
  });
});

// REST API to fetch all appointments
app.get('/get_appointments', (req, res) => {
  const query = 'SELECT * FROM appointment';

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.status(200).json(results);
  });
});

// REST API to approve or deny an appointment (PUT Method)
app.put('/update_appointment_status/:id', (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (status !== 'approved' && status !== 'denied') {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const query = `UPDATE appointment SET status = ? WHERE id = ?`;

  db.query(query, [status, id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Emit the status update to all connected clients
    io.emit('appointment_status_update', { id, status });

    res.status(200).json({ id, status });
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const port = 5500;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
