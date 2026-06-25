import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Authorization token missing or invalid",
    });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId ?? decoded.id,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      status: "error",
      message: "Invalid Token",
    });
  }
};
