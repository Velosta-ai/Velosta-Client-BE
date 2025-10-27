import prisma from "../config/db.js";

// Create a blog (requires login)
export const createBlog = async (req, res) => {
  try {
    const { title, summary, content, coverImage, tags, authorName } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const blog = await prisma.blog.create({
      data: {
        title,
        summary: summary || "",
        content,
        coverImage: coverImage || "",
        tags: tags || [],
        authorName: authorName || req.user.name || "Traveler",
        authorId: req.user.id,
      },
    });

    res.status(201).json(blog);
  } catch (err) {
    console.error("Create blog error:", err);
    res.status(500).json({ error: "Failed to create blog" });
  }
};

// Get all blogs
export const getAllBlogs = async (req, res) => {
  try {
    const blogs = await prisma.blog.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
};

// Get a specific blog by id
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await prisma.blog.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog" });
  }
};

// Delete a blog (only author can delete)
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.authorId !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });

    await prisma.blog.delete({ where: { id } });
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
};
