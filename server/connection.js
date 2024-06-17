const mysql = require("mysql2");

const collectiondb = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "chiraniasanskar@Gmail.com",
  database: "collectiondb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

collectiondb.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Database connected successfully");
  }
});
module.exports = collectiondb;
