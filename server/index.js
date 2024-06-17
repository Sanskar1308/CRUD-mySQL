require("dotenv").config({ path: "server/.env" });
const connection = require("./connection");
const user = require("./user");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const tokenBlacklist = new Set();
const crypto = require("crypto");
const nodemailer = require("nodemailer");

app.use(bodyParser.json());
app.use(express.json());
const corsOptions = {
  origin: "http://localhost:3000", // Allow requests from this origin
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allowed methods
  credentials: true, // Allow cookies to be sent with requests
  optionsSuccessStatus: 204, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const authenticatetoken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.log("Not FOund!!!");
    res.status(401).send();
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Decoded Token: ", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed: ", err);
    return res.sendStatus(403);
  }
};

app.get("/collection", authenticatetoken, async (req, res) => {
  const userId = req.user.userId; // Extract userId from authenticated token
  console.log(process.env.EMAIL);
  try {
    const [rows] = await connection
      .promise()
      .query("SELECT * FROM collection WHERE userId = ? ", [userId]);
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while fetching the collection.");
  }
});

app.get("/fullCollection", authenticatetoken, async (req, res) => {
  const userId = req.user.userId; // Extract userId from authenticated token

  try {
    const [rows] = await connection
      .promise()
      .query("SELECT * FROM collection WHERE userId = ? ", [userId]);
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while fetching the collection.");
  }
});

app.get("/collection/:id", async (req, res) => {
  try {
    const [rows] = await connection
      .promise()
      .query("SELECT * FROM collection WHERE id=?", [req.params.id]);
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while fetching the collection.");
  }
});

app.post("/collection", authenticatetoken, async (req, res) => {
  const { title, author } = req.body;
  const userId = req.user.userId;

  if (!title || !author) {
    return res.status(400).send("Title and author are required.");
  }

  try {
    const [result] = await user
      .promise()
      .query("SELECT COUNT(*) AS user_count FROM user WHERE id = ?", [userId]);
    const userCount = result[0].user_count;

    if (userCount <= 0) {
      return res.status(200).send("User doesn't exist.");
    }

    const [insertResult] = await connection
      .promise()
      .query(
        "INSERT INTO collection (title, author, userId) VALUES (?, ?, ?)",
        [title, author, userId]
      );
    res.status(201).send(`Record added with ID: ${insertResult.insertId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while inserting the record.");
  }
});

app.patch("/collection/:id", async (req, res) => {
  const id = req.params.id;
  const { title, author } = req.body;

  if (!title || !author) {
    return res.status(400).send("Title and author are required.");
  }

  const coll = { title, author };

  try {
    const [result] = await connection
      .promise()
      .query("UPDATE collection SET ? WHERE id = ?", [coll, id]);
    if (result.affectedRows > 0) {
      res.status(200).send(`Record with ID: ${id} updated successfully.`);
    } else {
      res.status(404).send(`Record with ID: ${id} not found.`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while updating the record.");
  }
});

app.put("/collection/:id", (req, res) => {
  const id = req.params.id;
  const { title, author } = req.body;

  if (!title || !author) {
    return res.status(400).send("Title and author are required.");
  }

  const coll = { title, author };

  connection.query(
    "UPDATE collection SET ? WHERE id = ?",
    [coll, id],
    (err, result) => {
      if (result.affectedRows === 0) {
        connection.query(
          "INSERT INTO collection (title, author) VALUES (?, ?)",
          [title, author],
          (err, result) => {
            if (err) {
              console.error(err);
              res
                .status(500)
                .send("An error occurred while inserting the record.");
            } else {
              res.status(201).send(`Record added with ID: ${result.insertId}`);
            }
          }
        );
      } else {
        if (result.affectedRows > 0) {
          res.status(200).send(`Record with ID: ${id} updated successfully.`);
        } else {
          res.status(404).send(`Record with ID: ${id} not found.`);
        }
      }
    }
  );
});

app.delete("/collection/:id", async (req, res) => {
  try {
    const [result] = await connection
      .promise()
      .query("DELETE FROM collection WHERE id=?", [req.params.id]);
    if (result.affectedRows > 0) {
      res
        .status(200)
        .send(`Record with ID: ${req.params.id} deleted successfully.`);
    } else {
      res.status(404).send(`Record with ID: ${req.params.id} not found.`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while deleting the record.");
  }
});

app.post("/signup", async (req, res) => {
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(req.body.password, 5);
  const { name, email } = req.body;

  user.query(
    "SELECT COUNT(*) AS email_count FROM user WHERE email = ?",
    [email],
    (err, result) => {
      if (err) {
        console.error(err);
        res
          .status(500)
          .send("An error occurred while checking user existence.");
        return; // Return early if there's an error
      }

      const emailCount = result[0].email_count;
      if (emailCount > 0) {
        res.status(200).send(`User with email ${email} already exists.`);
      } else {
        // Insert the user only if the email doesn't exist
        user.query(
          "INSERT INTO user (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword],
          (err, result) => {
            if (err) {
              console.error(err);
              res.status(500).send("An error occurred while creating user.");
            } else {
              res
                .status(201)
                .send(`User account created with ID: ${result.insertId}`);
            }
          }
        );
      }
    }
  );
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Query the database for the user
  user.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error retrieving user from database");
      }

      if (results.length === 0) {
        console.log("User not found");
        return res.status(400).send("Cannot find user");
      }

      const user = results[0];

      try {
        // Compare the provided password with the stored hashed password
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        console.log("Password Match:", isPasswordMatch);

        if (isPasswordMatch) {
          // Create a JWT token
          const token = jwt.sign(
            { userId: user.id },
            process.env.ACCESS_TOKEN_SECRET,
            {
              expiresIn: "1h",
            }
          );

          // Respond with the token
          res.setHeader("Content-Type", "application/json"); // Set Content-Type header
          res.json({
            msg: "Login successful",
            token: token,
          });
        } else {
          console.log("Invalid password");
          res.status(400).send("Invalid password");
        }
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
      }
    }
  );
});

app.post("/logout", authenticatetoken, (req, res) => {
  try {
    // Extract the token from the authorization header
    const token = req.headers.authorization?.split(" ")[1];
    // Add the token to the blacklist
    token && tokenBlacklist.add(token);

    // Respond with a success message
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error during logout", error: error.message });
  }
});

function generateOtp() {
  const otp = crypto.randomBytes(3).toString("hex");
  return parseInt(otp, 16).toString().slice(0, 6);
}

app.post("/forgetPassword", async (req, res) => {
  const { email } = req.body;

  // Query the database for the user
  user.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    async (err, userResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error retrieving user from database");
      }

      if (userResults.length === 0) {
        console.log("User not found");
        return res.status(400).send("Cannot find user");
      }

      try {
        const otp = generateOtp();
        const time = Date.now() + 300000; // 5 minutes from now

        // Update the user record with the OTP and expiration time
        user.query(
          "UPDATE user SET resetPasswordOTP = ?, resetPasswordExpires = ? WHERE email = ?",
          [otp, time, email],
          (err, result) => {
            if (err) {
              console.error(err);
              return res
                .status(500)
                .send("An error occurred while generating OTP.");
            }

            var transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD_APP_EMAIL,
              },
            });

            var mailOptions = {
              from: process.env.EMAIL,
              to: "chiraniasanskar@gmail.com",
              subject: "Password Reset OTP",
              text: `Your OTP for password reset is: ${otp}`,
            };

            transporter.sendMail(mailOptions, function (error, info) {
              if (error) {
                console.log(error);
                return res.status(500).send({ status: "Failed to send email" });
              } else {
                console.log("Email sent: " + info.response);
                return res.send({ msg: "OTP sent to email" });
              }
            });
          }
        );
      } catch (e) {
        console.log(e);
        res.status(500).send({ status: "An error occurred" });
      }
    }
  );
});

app.post("/verifyOtp", (req, res) => {
  const { email, otp } = req.body;

  // Query the database for the user
  user.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    (err, userResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error retrieving user from database");
      }

      if (userResults.length === 0) {
        console.log("User not found");
        return res.status(400).send({ status: "User not found!" });
      }

      const userData = userResults[0];

      // Check if the OTP matches and is not expired
      if (
        userData.resetPasswordOTP === otp &&
        userData.resetPasswordExpires > Date.now()
      ) {
        return res.send({ status: "OTP verified. Proceed to reset password." });
      } else {
        return res.status(400).send({ status: "Invalid or expired OTP!" });
      }
    }
  );
});

app.post("/resetPassword", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const encryptedPassword = await bcrypt.hash(newPassword, 10);

  user.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    (err, userResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error retrieving user from database");
      }

      if (userResults.length === 0) {
        console.log("User not found");
        return res.status(400).send({ status: "User not found!" });
      }

      const userData = userResults[0];

      // Check if the OTP matches and is not expired
      if (
        userData.resetPasswordOTP === otp &&
        userData.resetPasswordExpires > Date.now()
      ) {
        user.query(
          "UPDATE user SET password = ?, resetPasswordOTP = ?, resetPasswordExpires = ? WHERE email = ?",
          [encryptedPassword, null, null, email],
          (err, result) => {
            if (err) {
              console.error(err);
              return res
                .status(500)
                .send("An error occurred while updating the password.");
            }
            return res
              .status(200)
              .send({ status: "Password updated successfully." });
          }
        );
      } else {
        return res.status(400).send({ status: "Invalid or expired OTP!" });
      }
    }
  );
});

app.listen(3001, () => console.log("Server is running on port 3001..."));
