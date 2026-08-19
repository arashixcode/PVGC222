const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Upload folder ဖန်တီးရန်
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

// Website ဝင်လာလျှင် Gp01.html ကို ပထမဆုံးပြရန်
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gp01.html'));
});

// Database ဖိုင်များ
const USERS_FILE = 'users.json';
const MESSAGES_FILE = 'messages.json';

// Users ဒေတာဖတ်ရန်
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUsers = [
            { username: 'User_alpha', password: 'AlphaPass#2026' },
            { username: 'user_beta', password: 'BetaPass#2026' },
            { username: 'user_gamma', password: 'GammaPass#2026' },
            { username: 'user_delta', password: 'DeltaPass#2026' },
            { username: 'user_epsilon', password: 'EpsPass#2026' },
            { username: 'user_zeta', password: 'ZetaPass#2026' },
            { username: 'user_eta', password: 'EtaPass#2026' },
            { username: 'user_theta', password: 'ThetaPass#2026' },
            { username: 'user_iota', password: 'IotaPass#2026' },
            { username: 'user_kappa', password: 'KappaPass#2026' }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Messages သိမ်းရန်
function getMessages() {
    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(MESSAGES_FILE));
}

function saveMessages(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// Upload API Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ path: `uploads/${req.file.filename}` });
});

let activeDevices = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Login စစ်ဆေးခြင်း
    socket.on('verify login', ({ username, password }, callback) => {
        const users = getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            callback({ success: true });
        } else {
            callback({ success: false });
        }
    });

    // User အသစ်ထည့်ရန်
    socket.on('add new user', ({ username, password }, callback) => {
        const users = getUsers();
        if (users.some(u => u.username === username)) {
            return callback({ success: false, message: 'Username already exists' });
        }
        users.push({ username, password });
        saveUsers(users);
        callback({ success: true });
    });

    // Room ထဲဝင်ခြင်း
    socket.on('join room', ({ room, username }) => {
        socket.join(room);
        
        activeDevices = activeDevices.filter(d => d.id !== socket.id);
        activeDevices.push({ id: socket.id, username, room, device: socket.handshake.headers['user-agent'] });

        const messages = getMessages();
        const roomMessages = messages.filter(m => m.room === room);
        socket.emit('load history', roomMessages);
    });

    // စာပေးပို့ခြင်း
    socket.on('chat message', (data) => {
        const messages = getMessages();
        const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            room: data.room,
            name: data.name,
            avatar: data.avatar,
            type: data.type,
            content: data.content,
            timestamp: Date.now()
        };
        messages.push(newMessage);
        saveMessages(messages);

        io.to(data.room).emit('chat message', newMessage);
    });

    // စာဖျက်ခြင်း (Admin သာ)
    socket.on('delete message', ({ room, id }) => {
        let messages = getMessages();
        messages = messages.filter(m => m.id !== id);
        saveMessages(messages);

        io.to(room).emit('remove message', id);
    });

    // Active devices စစ်ဆေးရန်
    socket.on('get devices', (callback) => {
        callback(activeDevices);
    });

    // Users စာရင်း အပြည့်အစုံထုတ်ပေးရန်
    socket.on('get users list', (callback) => {
        const users = getUsers();
        callback(users.map(u => u.username));
    });

    socket.on('disconnect', () => {
        activeDevices = activeDevices.filter(d => d.id !== socket.id);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
