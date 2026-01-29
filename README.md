# NRG Market - Energy Market Prediction & Optimization

AI-powered energy market optimization platform for maximizing revenue through intelligent arbitrage and predictive analytics.

## 🚀 Features

- **Market Analytics**: Real-time energy market data visualization and analysis
- **Price Forecasting**: AI-powered price prediction using machine learning models
- **Optimization Engine**: Co-optimization algorithms for energy trading strategies
- **Data Upload**: Custom data integration for personalized analysis
- **Interactive Dashboard**: Modern, responsive UI with real-time charts

## 🏗️ Project Structure

```
energy-market-prediction/
├── frontend/               # React + Vite frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   └── main.jsx       # Application entry point
│   ├── public/            # Static assets
│   └── package.json
│
└── backend/               # Node.js + Python backend
    ├── src/               # Node.js API server
    │   ├── app.js
    │   ├── server.js
    │   ├── controllers/
    │   ├── middlewares/
    │   ├── routes/
    │   ├── services/
    │   └── utils/
    │
    └── python/            # Python optimization & forecasting
        ├── Cooptimization.py
        ├── params.py
        ├── pull_prices.py
        ├── forecasting/
        ├── data/
        ├── optimization_results/
        └── scripts/
```

## 🛠️ Technology Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Chart.js** - Data visualization
- **Lucide React** - Icon library

### Backend
- **Node.js** - API server
- **Express.js** - Web framework
- **Python** - Machine learning and optimization
  - Forecasting models
  - Co-optimization algorithms
  - Price data processing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- Python (v3.8 or higher)
- npm or yarn

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

#### Node.js Server
```bash
cd backend
npm install
npm start
```

#### Python Environment
```bash
cd backend/python
pip install -r requirements.txt
```

## 🚀 Usage

1. **Start the Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Navigate to the Application**
   - Open your browser to `http://localhost:5173`
   - Explore the home page, analytics dashboard, and data upload features

## 📊 Features Overview

### Analytics Dashboard
- Real-time market price visualization
- Historical trend analysis
- Predictive forecasting charts
- Performance metrics

### Data Upload
- Custom CSV/Excel file upload
- Data validation and preprocessing
- Integration with optimization models

### Optimization Engine
- Co-optimization algorithms ([Cooptimization.py](backend/python/Cooptimization.py))
- Parameter configuration ([params.py](backend/python/params.py))
- Market price integration ([pull_prices.py](backend/python/pull_prices.py))

## 🔧 Configuration

### Frontend Configuration
- Vite config: [vite.config.js](frontend/vite.config.js)
- Tailwind config: [tailwind.config.js](frontend/tailwind.config.js)
- ESLint config: [eslint.config.js](frontend/eslint.config.js)

### Backend Configuration
- Server settings in [src/server.js](backend/src/server.js)
- Python parameters in [python/params.py](backend/python/params.py)

## 🤝 Contributing

 Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open source and available under the MIT License.