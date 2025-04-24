/**
 * HOW TO FIX YOUR EXPRESS ROUTE ORDER PROBLEM
 * --------------------------------------------
 *
 * You need to add your routes BEFORE the ERROR HANDLING section.
 *
 * 1. Open server/index.js
 *
 * 2. Find the ERROR HANDLING section (around line 4545)
 *    // ==================== ERROR HANDLING ====================
 *
 * 3. Add your test route BEFORE this section, for example:
 *    app.get("/tester", async (req, res) => {
 *      res.send("Hello World");
 *    });
 *
 * 4. Move all route definitions that appear AFTER the 404 handler to BEFORE the ERROR HANDLING section.
 *    Check the route: app.delete("/api/teachers/cancel", auth, async (req, res) => {...});
 *    which appears after the 404 handler - this is wrong and needs to be moved!
 *
 * 5. Always make sure ALL route definitions are BEFORE the ERROR HANDLING section.
 *    The 404 handler must truly be THE LAST middleware!
 */

// Example of correct order:
/*
// Normal routes
app.get("/api/some-endpoint", (req, res) => {...});

// Add your tester route
app.get("/tester", (req, res) => {
  res.send("Hello World");
});

// ERROR HANDLING section
app.use((err, req, res, next) => {...});

// 404 handler - MUST BE LAST
app.use((req, res) => {...});
*/
