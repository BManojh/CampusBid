const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "campusbid-local-development-secret";

function configureSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      socket.user = jwt.verify(token, JWT_SECRET);
      socket.join(`user:${socket.user.sub}`);
      next();
    } catch {
      next(new Error("Invalid session"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("auction:join", (listingId) => {
      if (typeof listingId === "string" && listingId.length < 100) socket.join(`auction:${listingId}`);
    });
    socket.on("auction:leave", (listingId) => socket.leave(`auction:${listingId}`));
  });
}

module.exports = { configureSocket };
