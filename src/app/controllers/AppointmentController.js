const Yup = require('yup');
const { startOfHour, parseISO, isBefore, format, subHours } = require('date-fns');
const pt = require('date-fns/locale/pt');

const Appointment = require('../models/Appointment');
const Notification = require('../schemas/Notification');
const User = require('../models/User');
const File = require('../models/File');
const Queue = require('../../lib/Queue');
const CancelationMail = require('../jobs/CancelationMail');

class AppointmentController {
    async store(req, res) {
        const schema = Yup.object().shape({
            date: Yup.date().required(),
            provider_id: Yup.number().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.json(400).json({ error: 'Validation fails' });
        }

        const {  provider_id, date } = req.body;

        const isProvider = await User.findOne({ where: {id: provider_id, provider: true }});
        if (!isProvider) {
            return res.status(401).json({ error: 'You can only create appointments with providers' });
        }

        const hourStart = startOfHour(parseISO(date));
        if (isBefore(hourStart, new Date())) {
            return res.status(400).json({ error: 'Past dates are not allowed' });
        }

        const checkAvailability = await Appointment.findOne({ where: { provider_id, canceled_at: null, date: hourStart }});
        if (checkAvailability) {
            return res.status(400).json({ error: 'Appointment date is not available' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        //Notificar provedor
        const user = await User.findByPk(req.userId);
        const formattedDate = format(hourStart, "'dia 'dd' de 'MMMM', às' H:mm'h'", { locale: pt })

        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }

    async index(req, res) {
        //agendamentos paginados
        const { page = 1 } = req.query;

        const appointments = await Appointment.findAll({ 
            where: { 
                user_id: req.userId, 
                canceled_at: null 
            },
            order: ['date'],
            attributes: ['id', 'date', 'past', 'cancelable'],
            limit: 10,
            offset: (page - 1) * 10,
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name', 'email'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['path', 'url'],
                        }
                    ]
                }
            ]
        });

        return res.json(appointments);
    }

    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email'],
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                }
            ]
        });

        if (appointment.user_id != req.userId) {
            return res.status(401).json({ error: 'You are not the owner of this appointment.' });
        }

        const dateWithSub = subHours(appointment.date, 2);

        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({ error: 'Appointments can only be canceled with 2 hours in advance.' });
        }

        appointment.canceled_at = new Date();

        await appointment.save();

        await Queue.add(CancelationMail.key, {
            appointment,
        });

        return res.json(appointment);
    }
}

module.exports = new AppointmentController();