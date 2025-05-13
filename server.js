const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: 'https://kabu03.github.io',
  methods: 'GET,POST',
  credentials: true
}));

const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    tls: true, // Ensure TLS/SSL is enabled
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if the server is not reachable
  });
  
  async function connectDB() {
    try {
      await client.connect();
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error("Failed to connect to MongoDB:", err);
    }
  }

connectDB();

app.use(express.json()); // for raw JSON bodies
app.use(express.urlencoded({ extended: true })); // for form-style bodies

app.get('/api/blogs', async (req, res) => {
    try {
        const database = client.db("blog-db");
        const blogs = database.collection("blogs");
        const blogList = await blogs.find().sort({ createdAt: -1 }).toArray();
        res.json(blogList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});


app.post('/api/blogs', async (req, res) => {
    try {
      // 1. Check the provided password against SECRET_PW
      if (req.body.pw !== process.env.SECRET_PW) {
        return res.status(403).json({ error: "Unauthorized: incorrect password" });
      }

      const database = client.db("blog-db");
      const blogs = database.collection("blogs");

      const slug = req.body.title
        ?.toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, ""); // Replace non-alphanumeric characters

      const newBlog = {
        title: req.body.title?.trim() || null,
        slug: slug,
        body: req.body.body?.trim() || null,
        image: req.body.image || null,
        category: req.body.category?.trim().toLowerCase() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 2. Basic validation that title and body exist
      if (!newBlog.title || !newBlog.body) {
        return res.status(400).json({ error: "Title and body are required fields" });
      }

      // 3. Insert the new blog since the password check succeeded
      await blogs.insertOne(newBlog);
      res.status(201).json({ message: "Blog added successfully", slug: slug });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add blog" });
    }
});

app.get('/api/blogs/:slug', async (req, res) => {
    try {
        const database = client.db("blog-db");
        const blogs = database.collection("blogs");
        const blog = await blogs.findOne({ slug: req.params.slug });

        if (!blog) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        res.json(blog);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch blog' });
    }
});

// UPDATE a blog post by slug
app.put('/api/blogs/:slug', async (req, res) => {
    try {
        // 1. Check the provided password
        if (req.body.pw !== process.env.SECRET_PW) {
            return res.status(403).json({ error: "Unauthorized: incorrect password" });
        }

        const database = client.db("blog-db");
        const blogsCollection = database.collection("blogs");
        const originalSlug = req.params.slug;

        // Basic validation
        if (!req.body.title || !req.body.body) {
            return res.status(400).json({ error: "Title and body are required fields" });
        }

        // If title changes, slug might need to change.
        // Your current slug generation:
        const newSlug = req.body.title
            ?.toLowerCase()
            .replace(/ /g, "-") // Replace spaces with hyphens
            .replace(/[^\w-]+/g, ""); // Replace non-alphanumeric characters except hyphens

        const updatedBlogData = {
            title: req.body.title?.trim(),
            slug: newSlug, // Update the slug if title changed
            body: req.body.body?.trim(),
            image: req.body.image || null,
            category: req.body.category?.trim().toLowerCase() || null,
            updatedAt: new Date(),
            // createdAt should remain unchanged, so we don't include it here from req.body
        };

        const result = await blogsCollection.updateOne(
            { slug: originalSlug },
            { $set: updatedBlogData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Blog not found with the original slug' });
        }
        if (result.modifiedCount === 0 && result.matchedCount === 1) {
            // This can happen if the submitted data is identical to the existing data
            return res.status(200).json({ message: "Blog data was the same, no changes made.", slug: newSlug });
        }

        res.status(200).json({ message: "Blog updated successfully", slug: newSlug });

    } catch (err) {
        console.error('Error updating blog:', err);
        res.status(500).json({ error: 'Failed to update blog' });
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
