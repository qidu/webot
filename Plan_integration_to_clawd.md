  Current Architecture vs. Required Architecture                                                                                           
                                                                                                                                           
  Current Webot (server.ts)                                                                                                                
                                                                                                                                           
  - HTTP: Serves static files and /api/config on port 3010                                                                                 
  - WebSocket: Proxies connections to gateway (injects auth token)                                                                         
  - Frontend: Connects to local WebSocket proxy on port 3010                                                                               
                                                                                                                                           
  Required Integration                                                                                                                     
                                                                                                                                           
  - HTTP: Serve static files at http://127.0.0.1:18789/webot (via moltbot handler chain)                                                   
  - WebSocket: Frontend connects directly to ws://127.0.0.1:18789 (moltbot gateway)                                                       
  - No WebSocket proxy needed in webot server                                                                                              
  
  # Goal: webot HTTP services run at http://127.0.0.1:18789/webot, websocket endpoint just use moltbot's gateway ws://127.0.0.1:18789


  Key Changes Needed                                                                                                                       
                                                                                                                                           
  1. Simplify Webot Server (server.ts)                                                                                                     
                                                                                                                                           
  Remove WebSocket proxy functionality, keep only:                                                                                         
  - Static file serving (HTML, JS, CSS)                                                                                                    
  - /api/config endpoint (returns gateway URL and token)                                                                                   
  - No WebSocket server                                                                                                                    
                                                                                                                                           
  2. Update Frontend (main.ts & websocket.ts)                                                                                              
                                                                                                                                           
  Change WebSocket connection from:                                                                                                        
  // Current: connects to local proxy                                                                                                      
  const gatewayUrl = url || this.configService.getGatewayUrl();                                                                            
  // Should be: connect directly to gateway                                                                                                
  const gatewayUrl = "ws://127.0.0.1:18789";                                                                                              
                                                                                                                                           
  3. Create Moltbot Integration Handler                                                                                                    
                                                                                                                                           
  Create a handler that:                                                                                                                   
  - Serves webot static files at /webot path                                                                                               
  - Routes /webot/api/config to webot's config endpoint                                                                                    
  - Returns false for non-webot paths (passes to next handler)                                                                             
                                                                                                                                           
  4. Authentication Handling                                                                                                               
                                                                                                                                           
  Since webot won't proxy WebSocket:                                                                                                       
  - Frontend must handle auth token injection in connect request                                                                           
  - Token should come from /api/config endpoint or environment                                                                             
                                                                                                                                           
  Implementation Plan                                                                                                                      
                                                                                                                                           
  Step 1: Simplify Webot Server                                                                                                            
                                                                                                                                           
  Create src/server-http-only.ts:                                                                                                          
  // HTTP-only server for static files and config                                                                                          
  export function createWebotHttpHandler(basePath: string = "/webot"): HooksRequestHandler {                                               
    return async (req, res) => {                                                                                                           
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);                                                                   
                                                                                                                                           
      // Check if this is a webot path                                                                                                     
      if (!url.pathname.startsWith(basePath)) return false;                                                                                
                                                                                                                                           
      // Remove base path prefix                                                                                                           
      const relativePath = url.pathname.slice(basePath.length) || "/";                                                                     
                                                                                                                                           
      // Handle /api/config                                                                                                                
      if (relativePath === "/api/config") {                                                                                                
        // Return gateway config                                                                                                           
        res.writeHead(200, { "Content-Type": "application/json" });                                                                        
        res.end(JSON.stringify({                                                                                                           
          gatewayUrl: "ws://127.0.0.1:18789",  // Direct to gateway                                                                       
          gatewayToken: process.env.GATEWAY_TOKEN                                                                                          
        }));                                                                                                                               
        return true;                                                                                                                       
      }                                                                                                                                    
                                                                                                                                           
      // Serve static files (index.html, main.js, etc.)                                                                                    
      // ... static file serving logic ...                                                                                                 
                                                                                                                                           
      return true;                                                                                                                         
    };                                                                                                                                     
  }                                                                                                                                        
                                                                                                                                           
  Step 2: Update Frontend WebSocket Connection                                                                                             
                                                                                                                                           
  In src/services/websocket.ts:                                                                                                            
  // Remove proxy logic, connect directly to gateway                                                                                       
  async connect(url?: string): Promise<void> {                                                                                             
    // Use provided URL or default to gateway                                                                                              
    const gatewayUrl = url || "ws://127.0.0.1:18789";                                                                                     
    // ... connection logic ...                                                                                                            
  }                                                                                                                                        
                                                                                                                                           
  Step 3: Integrate with Moltbot                                                                                                           
                                                                                                                                           
  In moltbot's server-http.ts:                                                                                                             
  // Add webot handler to chain                                                                                                            
  if (handleWebotRequest && (await handleWebotRequest(req, res))) return;                                                                  
                                                                                                                                           
  Step 4: Configuration                                                                                                                    
                                                                                                                                           
  Webot config should be minimal:                                                                                                          
  gateway:                                                                                                                                 
    webot:                                                                                                                                 
      enabled: true                                                                                                                        
      basePath: "/webot"                                                                                                                   
      # No port needed - uses gateway port                                                                                                 
                                                                                                                                           
  Benefits of This Approach                                                                                                                
                                                                                                                                           
  1. Simplified Architecture: No WebSocket proxy complexity                                                                                
  2. Direct Gateway Connection: Better performance, fewer hops                                                                             
  3. Consistent Authentication: Uses same gateway auth as other clients                                                                    
  4. Easier Maintenance: Less code to maintain                                                                                             
  5. Better Debugging: Direct WebSocket connection easier to trace                                                                         
                                                                                                                                           
  Challenges to Address                                                                                                                    
                                                                                                                                           
  1. CORS: Frontend connecting to different WebSocket origin                                                                               
    - Solution: Gateway should allow WebSocket connections from webot origin                                                               
  2. Path Prefixing: All static asset paths need /webot/ prefix                                                                            
    - Solution: Update HTML/JS references or use base tag                                                                                  
  3. Configuration Sharing: How webot gets gateway token                                                                                   
    - Solution: Environment variable or config file shared with moltbot                                                                    
  4. Development Workflow: Running webot standalone during development                                                                     
    - Solution: Keep dev server on port 3010 with WebSocket proxy for testing                                                              
                                                                                                                                           
  Recommended Implementation Order                                                                                                         
                                                                                                                                           
  1. First: Create simplified HTTP-only webot server                                                                                       
  2. Second: Update frontend to connect directly to gateway                                                                                
  3. Third: Create moltbot integration handler                                                                                             
  4. Fourth: Test integration locally                                                                                                      
  5. Fifth: Update build/deployment process                                                                                                
                                                                                                                                           
  This approach aligns with your requirement while maintaining architectural simplicity. The webot becomes a lightweight static file server
   that integrates seamlessly into moltbot's handler chain.                                                                                
