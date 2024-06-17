const mysql = require("mysql2");

const userdb = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "chiraniasanskar@Gmail.com",
  database: "userdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

userdb.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Database connected successfully");
  }
});
module.exports = userdb;
