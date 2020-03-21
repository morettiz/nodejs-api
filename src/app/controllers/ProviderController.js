const User = require('../models/User');
const File = require('../models/File');

class ProviderController {
    async index(req, res) {
        const providers = await User.findAll({ 
            where: { provider: true },
            attributes: ['id', 'name', 'email'],
            include: [{
                model: File,
                as: 'avatar',
                attributes: ['id', 'name', 'path', 'url'],
            }]
        });

        return res.json(providers);
    }
}

module.exports = new ProviderController();