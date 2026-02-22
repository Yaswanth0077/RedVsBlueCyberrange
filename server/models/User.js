import bcrypt from 'bcryptjs';

const users = [
    { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'Admin' },
    { id: 2, username: 'redteam', passwordHash: bcrypt.hashSync('red123', 10), role: 'RedTeam' },
    { id: 3, username: 'blueteam', passwordHash: bcrypt.hashSync('blue123', 10), role: 'BlueTeam' }
];

export const findUserByUsername = (username) => {
    return users.find(u => u.username === username);
};
