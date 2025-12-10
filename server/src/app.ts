import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import { authRoutes, productRoutes } from './routes';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware';

// Create Express application
const app: Application = express();

// Configuration
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS - Allow frontend to access API
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// ROUTES
// =============================================================================

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Supply Chain API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    success: true,
    name: 'Supply Chain DApp API',
    version: '1.0.0',
    description: 'Off-chain backend for Supply Chain DApp',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        getNonce: 'GET /api/auth/nonce/:walletAddress',
        linkWallet: 'POST /api/auth/link',
        getUser: 'GET /api/auth/user/:walletAddress',
        getAllUsers: 'GET /api/auth/users',
        // Multi-Wallet Endpoints
        addSecondaryWallet: 'POST /api/auth/link-wallet',
        removeWallet: 'DELETE /api/auth/wallet/:address',
        setPrimaryWallet: 'PUT /api/auth/primary-wallet'
      },
      products: {
        create: 'POST /api/products',
        getAll: 'GET /api/products',
        getById: 'GET /api/products/:id',
        getByChainId: 'GET /api/products/chain/:productId',
        getByManufacturer: 'GET /api/products/manufacturer/:address',
        getBatch: 'POST /api/products/batch',
        linkToChain: 'POST /api/products/:id/link',
        update: 'PUT /api/products/:id',
        delete: 'DELETE /api/products/:id'
      }
    }
  });
});

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Supply Chain DApp - Backend Server');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🖥️  Frontend URL: ${CLIENT_URL}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/auth/nonce/:walletAddress');
  console.log('  POST /api/auth/link');
  console.log('  GET  /api/auth/user/:walletAddress');
  console.log('  POST /api/products');
  console.log('  GET  /api/products');
  console.log('  GET  /api/products/chain/:productId');
  console.log('='.repeat(60));
});

export default app;
