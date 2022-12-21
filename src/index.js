const Game = require('./Game');
let game = null;

const server = require('http').createServer();
const { instrument } = require('@socket.io/admin-ui');

const io = require('socket.io')(server, {
    cors: {
        //TODO: добавить домен будущего сайта/сервера
        origin: ["http://localhost:3000", "http://localhost:8080", "https://admin.socket.io"],
        credentials: true
    }
});

// https://admin.socket.io
instrument(io, {
    auth: false,
    mode: "development"
});

server.listen(3000);

//TODO: привязать комнаты к юзерам??
let clients = {}
let currentRoom = 0;

function addedClient(client){
    clients[client.id] = client;
}

function removeClient(client){
    delete clients[client.id];
}

games = {}

//TODO: make it better
function freeRoom() {
    let numberOfClients = Object.keys(clients).length;
    if (numberOfClients % 2 == 0) {
        currentRoom++;
        game = new Game();
        game.start();
        games["room" + currentRoom] = game;
    }
    return "room" + currentRoom;
}

io.on('connection', function(socket){
    let room = freeRoom();
    socket.join(room);
    addedClient(socket.client);
    console.log(`User ${socket.client.id} connected to ${room}`);

    games[room].gameLoop(()=>{
        socket.emit("frame", {"image": games[room].vram, "fps": game.fps});
    })
    // let t = setInterval(()=>{
    //     socket.emit("frame", {"image": games[room].canvas.toDataURL(), "fps": game.fps, "audio_l": games[room].audio_l, "audio_r": games[room].audio_r});
    // }, 0);

    socket.on("disconnect",()=>{
        // TODO: Добавить удаление комнат и игр
        console.log(`User ${socket.client.id} disconnected from ${room}`);
        removeClient(socket.client)
        // clearInterval(t);
    });

    //TEST
    let clientIndex = Object.keys(clients).indexOf(socket.client.id);
    socket.on('button', function(value){
        //Todo: зачем тут 0 если мы передаем 0 при отпускании?
        // games[room].input[clientIndex] = 0x0000;
        games[room].input[clientIndex] = value;
    })

    socket.on('axes', function(value, index){
        games[room].input[index] = value;
    });
});
