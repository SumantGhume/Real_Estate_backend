import express from "express";
import con from "../database/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import cookieParser from "cookie-parser";

const router = express.Router();

// Middleware to parse cookies (IMPORTANT!)
router.use(cookieParser());

//! Upload Image Start
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });
//! Upload Image End

// Register Route
router.post("/register", upload.single("image"), (req, res) => {
  const sql = `INSERT INTO users 
    (name, email, password, address, phone, image) 
    VALUES (?)`;

  bcrypt.hash(req.body.password, 10, (err, hash) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });

    const values = [
      req.body.name,
      req.body.email,
      hash,
      req.body.address,
      req.body.phone,
      req.file.filename,
    ];

    con.query(sql, [values], (err, result) => {
      if (err) return res.json({ Status: false, Error: err });
      return res.json({ Status: true });
    });
  });
});

// Login Route
router.post("/user_login", (req, res) => {
  const sql = "SELECT * FROM users WHERE email = ?";
  con.query(sql, [req.body.email], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });

    if (result.length > 0) {
      bcrypt.compare(req.body.password, result[0].password, (err, response) => {
        if (err || !response)
          return res.json({ loginStatus: false, Error: "Wrong password" });

        const token = jwt.sign(
          { role: "user", email: result[0].email, id: result[0].id },
          "jwt_secret_key",
          { expiresIn: "1d" }
        );

        res.cookie("token", token, {
          httpOnly: true,
          sameSite: "Lax", // "None" if frontend on HTTPS with secure true
          // secure: true, // Enable this if using HTTPS
        });

        return res.json({ loginStatus: true });
      });
    } else {
      return res.json({ loginStatus: false, Error: "Wrong email or password" });
    }
  });
});

// ✅ Verify Route to get user ID
router.get("/verify", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.json({ loginStatus: false, Error: "No token found" });
  }

  jwt.verify(token, "jwt_secret_key", (err, decoded) => {
    if (err) {
      return res.json({ loginStatus: false, Error: "Invalid token" });
    } else {
      return res.json({
        loginStatus: true,
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      });
    }
  });
});


// In your backend route file
router.get('/logout', (req, res) => {
  res.clearCookie('token'); // or the cookie name you used
  return res.json({ logout: true });
});



router.get("/filtered-properties", (req, res) => {
  const { property_type, address_loc, property_size, price } = req.query;

  const sql = `
    SELECT 
      p.id, p.pro_name, p.owner_name, p.price, p.image, p.description,
      a.city
    FROM 
      property p
    JOIN 
      address a ON p.id = a.property_id
    JOIN 
      details d ON p.id = d.property_id
    WHERE 
      d.property_type LIKE ? AND
      a.city LIKE ? AND
      d.property_size LIKE ? AND
      p.price <= ?
  `;

  const values = [
    `%${property_type || ""}%`,
    `%${address_loc || ""}%`,
    `%${property_size || ""}%`, // Updated to use LIKE for VARCHAR/TEXT
    price || 999999999 // large fallback max price
  ];

  con.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error fetching filtered properties:", err);
      return res.json({ status: 'error', message: "Database error", error: err });
    }

    if (result.length > 0) {
      return res.json({ status: 'success', properties: result });
    } else {
      return res.json({ status: 'no_data', properties: [] });
    }
  });
});

router.get("/property/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      p.*, a.address_loc, a.city, a.zip_code, a.area, a.country, a.state,
      d.property_type, d.property_status, d.property_size, d.no_bedrooms, d.no_bathrooms, d.no_garage,
      f.air_conditioning, f.shared_gym, f.external_yard, f.dryer, f.gym, f.laundry, f.kitchen_appliances, 
      f.outdoor_shower, f.two_refrigerators, f.club_house, f.tv_cable, f.washer
    FROM 
      property p
    JOIN address a ON p.id = a.property_id
    JOIN details d ON p.id = d.property_id
    LEFT JOIN features f ON p.id = f.property_id
    WHERE p.id = ?
  `;

  con.query(sql, [id], (err, result) => {
    if (err) return res.json({ status: 'error', error: err });

    if (result.length === 0) {
      return res.json({ status: 'not_found' });
    }

    const row = result[0];
    const features = {
      air_conditioning: !!row.air_conditioning,
      shared_gym: !!row.shared_gym,
      external_yard: !!row.external_yard,
      dryer: !!row.dryer,
      gym: !!row.gym,
      laundry: !!row.laundry,
      kitchen_appliances: !!row.kitchen_appliances,
      outdoor_shower: !!row.outdoor_shower,
      two_refrigerators: !!row.two_refrigerators,
      club_house: !!row.club_house,
      tv_cable: !!row.tv_cable,
      washer: !!row.washer,
    };

    for (const key in features) delete row[key];

    return res.json({
      status: 'success',
      property: {
        ...row,
        features,
      },
    });
  });
});

router.get('/display_properties', (req, res) => {
  const sql = `
    SELECT 
      p.id,
      p.pro_name,
      p.image,
      a.address_loc,
      d.property_status,
      d.no_bedrooms,
      d.property_size,
      d.no_bathrooms
    FROM property p
    JOIN address a ON p.id = a.property_id
    JOIN details d ON p.id = d.property_id
    ORDER BY p.id DESC
  `;

  con.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching properties:", err);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }

    return res.status(200).json({ status: 'success', properties: result });
  });
});

router.post('/inquiry', (req, res) => {
  const { user_id, property_id, name, email, phone, message } = req.body;

  const sql = `
    INSERT INTO inquiries (user_id, property_id, name, email, phone, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  con.query(sql, [user_id, property_id, name, email, phone, message], (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, error: "Database error" });
    }
    res.json({ success: true });
  });
});




router.post("/feedback", (req, res) => {
  const { user_id, name, email, phone, rating, message } = req.body;

  if (!user_id || !name || !email || !rating || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO feedback (user_id, name, email, phone, rating, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  con.query(sql, [user_id, name, email, phone || null, rating, message], (err, result) => {
    if (err) {
      console.error("Error inserting feedback:", err);
      return res.status(500).json({ error: "Database insert failed" });
    }
    return res.status(200).json({ message: "Feedback submitted successfully" });
  });
});


// routes/user.js or appropriate route file
router.get("/testimonials", (req, res) => {
  const sql = `
    SELECT f.name, f.message, f.submitted_at, u.image 
    FROM feedback f 
    JOIN users u ON f.user_id = u.id 
    ORDER BY f.submitted_at DESC
  `;
  con.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching testimonials:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    return res.status(200).json(result);
  });
});

// ✅ GET user profile by ID
router.get("/profile/:id", (req, res) => {
  const userId = req.params.id;

  const sql = `
    SELECT id, name, email, phone, address, role, image, created_at
    FROM users
    WHERE id = ?
  `;

  con.query(sql, [userId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(result[0]); // return the first row
  });
});


router.put("/update/:id", (req, res) => {
  const { name, address, phone } = req.body;
  const sql = "UPDATE users SET name = ?, address = ?, phone = ? WHERE id = ?";

  con.query(sql, [name, address, phone, req.params.id], (err, result) => {
    if (err?.code === 'ER_DUP_ENTRY') {
  return res.status(409).json({ success: false, error: "Email already exists" });
}

    if (err) {
      console.error("Update error:", err);
      return res.json({ status: "error", message: "Update failed" });
    }
    return res.json({ status: "success", message: "Profile updated" });
  });
});

// Update profile image
router.post("/upload-image/:id", upload.single("image"), (req, res) => {
  const userId = req.params.id;
  const filename = req.file.filename;

  const sql = "UPDATE users SET image = ? WHERE id = ?";
  con.query(sql, [filename, userId], (err, result) => {
    if (err) {
      console.error("Image update error:", err);
      return res.status(500).json({ success: false });
    }
    return res.json({ success: true, filename });
  });
});




export { router as users };