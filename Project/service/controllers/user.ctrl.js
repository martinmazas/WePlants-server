const User = require('../models/user');
const Plant = require('../models/plants');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { writeBackLog } = require('../logs/logs');

// if token exist return id and user get authentication
const getUserId = (req, res) => {
    const token = req.cookies.token;

    let id;
    if (!token) {
        return;
    } else {
        jwt.verify(token, 'jwtSecret', (err, decoded) => {
            if (err) {
                res.json({ auth: false, message: 'authentication problem' })
            } else {
                id = decoded.id;
            }
        })
    }
    return id;
};

exports.userDBController = {
    getUsers(req, res) {
        const id = getUserId(req, res);
        if (id) {
            User.findOne({ id })
                .then(docs => {
                    const role = docs.role;
                    const firstName = docs.firstName;
                    const lastName = docs.lastName;
                    const myFavorites = docs.myFavorites;
                    const email = docs.email;
                    writeBackLog(`User ${id} successfully get info`);
                    res.json({ id, role, firstName, lastName, myFavorites, email });
                })
                .catch(err => writeBackLog(`Error getting the data from DB: ${err}`));
        }
        else {
            User.find({})
                .then(docs => res.send(docs))
                .catch(err => writeBackLog(err));
        }
    },
    getUser(req, res) {
        const id = getUserId(req, res);
        if (id != parseInt(req.params.id)) {
            res.send('Authentication error');
        } else {
            User.findOne({ id })
                .then(docs => {
                    const role = docs.role;
                    const firstName = docs.firstName;
                    const lastName = docs.lastName;
                    const myFavorites = docs.myFavorites;
                    const email = docs.email;
                    res.json({ id, role, firstName, lastName, myFavorites, email });
                })
                .catch(err => writeBackLog(`Error getting the data from DB: ${err}`));
        }
    },
    async addUser(req, res) {
        User.findOne({ email: req.body.email })
            .then(async docs => {
                if (docs) {
                    res.json('User already exist');
                }
                else {
                    const index = await new Promise((resolve, reject) => {
                        const index = User.findOne({}).sort({ _id: -1 }).limit(1);
                        resolve(index);
                    });
                    const newUser = new User({
                        "id": index.id + 1,
                        "role": "user",
                        "firstName": req.body.firstName,
                        "lastName": req.body.lastName,
                        "email": req.body.email,
                        "password": bcrypt.hashSync(req.body.password, 10),
                        "myFavorites": req.body.myFavorites
                    });
                    newUser.save()
                        .then(docs => {
                            const token = jwt.sign({ id: docs.id }, "jwtSecret");
                            res.cookie('token', token, { maxAge: 6000000, sameSite: 'none', secure: true, path: '/' });
                            res.json({
                                id: docs.id, role: docs.role, firstName: docs.firstName, lastName: docs.lastName, myFavorites: docs.myFavorites, email: docs.email
                            })
                        })
                        .catch(err => writeBackLog(`Error getting the data from DB: ${err}`));
                }
            })
            .catch(err => writeBackLog(err));
    },

    async login(req, res) {
        User.findOne({ email: req.params.email })
            .then(docs => {
                if (docs) {
                    if (!bcrypt.compareSync(req.body.password, docs.password)) {
                        res.json('Wrong password');
                    }
                    else {
                        const id = docs.id;
                        const token = jwt.sign({ id }, "jwtSecret");
                        res.cookie('token', token, { maxAge: 6000000, sameSite: 'none', secure: true });
                        writeBackLog(`Successfully log in to user ${id}`);
                        res.json({ id: docs.id, role: docs.role, firstName: docs.firstName, lastName: docs.lastName, myFavorites: docs.myFavorites, email: docs.email });
                    }
                }
                else {
                    res.json('User does not exist');
                }
            })
            .catch(err => writeBackLog(`Error getting the data from DB: ${err}`));
    },
    async updateUserOrAddToFavorites(req, res) {
        const userId = getUserId(req, res);
        if (userId != parseInt(req.params.id)) {
            res.send('Authentication error');
        }
        else {
            User.findOne({ id: parseInt(userId) })
                .then(docs => {
                    const max = docs.myFavorites.reduce((prev, curr) => prev = prev > curr.id ? prev : curr.id, 0);
                    Plant.findOne({ id: parseInt(req.query.plantId) })
                        .then(docs => {
                            User.findOneAndUpdate({ id: userId }, {
                                $push: {
                                    "myFavorites": {
                                        id: max + 1, plantName: docs.plantName, description: docs.description,
                                        imageUrl: docs.imageUrl, date: moment().format("YYYY-MM-DD"), wayOfCare: docs.wayOfCare
                                    }
                                }
                            },
                                { new: true })
                                .then(docs => res.json({ id: docs.id, role: docs.role, firstName: docs.firstName, lastName: docs.lastName, myFavorites: docs.myFavorites, email: docs.email }))
                                .catch(err => writeBackLog(err));
                        })
                        .catch(err => writeBackLog(err));
                })
                .catch(err => writeBackLog(err));
        }
    },

    deleteUserOrFavoritePlant(req, res) {
        const userId = getUserId(req, res);
        if (userId == parseInt(req.params.id) && req.query.plantId) {
            User.findOneAndUpdate({ id: userId }, { $pull: { "myFavorites": { id: parseInt(req.query.plantId) } } }, { new: true })
                .then(docs => res.json({ id: docs.id, role: docs.role, firstName: docs.firstName, lastName: docs.lastName, myFavorites: docs.myFavorites, email: docs.email }))
                .catch(err => writeBackLog(err));
        }
        else {
            User.findOneAndDelete({ id: parseInt(req.params.id) })
                .then(docs => { res.json(docs) })
                .catch(err => writeBackLog(`Error getting the data from DB: ${err}`));
        }
    }
};