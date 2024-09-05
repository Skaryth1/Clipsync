require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const TOKEN = process.env.DISCORD_TOKEN; // Carregando o token do Discord
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID;
const CREDENTIALS_CHANNEL_ID = process.env.CREDENTIALS_CHANNEL_ID;
const usersFile = 'users.json';

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Servir arquivos estáticos

// Função para garantir que o arquivo users.json exista
function ensureUsersFile() {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify({}));
    }
}

// Função para verificar se as credenciais estão corretas
async function checkCredentials(username, password) {
    const channel = client.channels.cache.get(CREDENTIALS_CHANNEL_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 100 });
        const credentialMessages = messages.filter(msg => msg.content.startsWith('Credenciais:'));
        for (const msg of credentialMessages.values()) {
            const [storedUsername, storedPassword] = msg.content.replace('Credenciais: ', '').split(':');
            if (storedUsername === username && storedPassword === password) {
                return true;
            }
        }
    }
    return false;
}

// Função para armazenar credenciais no canal privado
function storeCredentials(username, password) {
    console.log('Armazenando credenciais...');
    const channel = client.channels.cache.get(CREDENTIALS_CHANNEL_ID);
    if (channel) {
        channel.send(`Credenciais: ${username}:${password}`);
    } else {
        console.log('Canal de credenciais não encontrado');
    }
}

// Quando o bot estiver pronto
client.once('ready', () => {
    console.log('Bot está online!');
});

// Rota para cadastro
app.post('/register', (req, res) => {
    console.log('Requisição de registro recebida');
    ensureUsersFile();

    const { username, password } = req.body;

    fs.readFile(usersFile, (err, data) => {
        if (err) {
            console.log('Erro ao ler arquivo de usuários:', err);
            return res.status(500).send('Erro ao ler arquivo de usuários');
        }

        const users = JSON.parse(data);

        if (users[username]) {
            return res.status(400).send('Usuário já existe');
        }

        users[username] = password;

        fs.writeFile(usersFile, JSON.stringify(users, null, 2), (err) => {
            if (err) {
                console.log('Erro ao salvar usuário:', err);
                return res.status(500).send('Erro ao salvar usuário');
            }

            storeCredentials(username, password); // Armazenar credenciais no canal privado

            res.status(200).send('Cadastro realizado com sucesso');
        });
    });
});

// Rota para login
app.post('/login', async (req, res) => {
    console.log('Requisição de login recebida');
    const { username, password } = req.body;

    // Verificar credenciais no canal privado
    const isValid = await checkCredentials(username, password);
    if (isValid) {
        res.status(200).send('Login realizado com sucesso');
    } else {
        res.status(401).send('Credenciais inválidas');
    }
});

// Recebe requisição para postar mensagem
app.post('/post', (req, res) => {
    console.log('Requisição de postagem recebida');
    const { username, content } = req.body;
    const channel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (channel) {
        channel.send(`${username}: ${content}`);
        res.status(200).send('Postagem criada');
    } else {
        res.status(500).send('Canal não encontrado');
    }
});

// Rota para obter postagens
app.get('/posts', async (req, res) => {
    console.log('Requisição de postagens recebida');
    const channel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 100 });
        res.json(messages.filter(msg => !msg.content.startsWith('Credenciais:')).map(msg => ({ user: msg.author.username, content: msg.content })));
    } else {
        res.status(500).send('Canal não encontrado');
    }
});

// Rota para servir a página principal
app.get('/', (req, res) => {
    console.log('Servindo página principal');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para servir a página de registro
app.get('/register', (req, res) => {
    console.log('Servindo página de registro');
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Inicie o servidor web
app.listen(3000, () => {
    console.log('Servidor web rodando na porta 3000');
});

// Faça o bot se conectar ao Discord
client.login(TOKEN);
