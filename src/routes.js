const Router = require('express');
const multer = require('multer');

const User = require('./app/models/User');
const UserController = require('./app/controllers/UserController');
const SessionController = require('./app/controllers/SessionController');
const authMiddleware = require('./app/middlewares/auth');
const multerConfig = require('./config/multer');

const routes = new Router();
const upload = multer(multerConfig);

// routes.get('/', async (req, res) => {
//     const user = await User.create({
//         name: 'Mauri Moretti',
//         email: 'mauri.moretti@gmail.com',
//         password_hash: '232434',
//     });

//     return res.json({user});
// });

routes.post('/users', UserController.store);
routes.put('/users/', authMiddleware, UserController.update);

routes.post('/sessions', SessionController.store);

routes.post('/files', upload.single('file'), (req, res) => {
    return res.json({ ok: true })
});

module.exports = routes;