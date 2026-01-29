import React, { useState, useMemo, memo } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import Papa from 'papaparse';
import './visualizeTradesReserves.css';

// Constants for performance optimization
const LARGE_DATASET_THRESHOLD = 1000;
const VERY_LARGE_DATASET_THRESHOLD = 5000;

export default function ChartCSVTutorial() {
  const [csvData, setCsvData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [chartType, setChartType] = useState('line');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isStacked, setIsStacked] = useState(false);

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setHasError(false);
    setFileName(file.name);

    // Parse CSV using Papaparse
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        console.log('Parsed CSV:', results.data);
        console.log('Data points:', results.data.length);
        // Simulate processing time for better UX
        setTimeout(() => {
          setCsvData(results.data);
          setIsLoading(false);
        }, 800);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setHasError(true);
        setIsLoading(false);
        alert('Error parsing CSV file');
      }
    });
  };

  // Sample data for demonstration
  const sampleData = [
    { month: 'Jan', sales: 4000, revenue: 2400 },
    { month: 'Feb', sales: 3000, revenue: 1398 },
    { month: 'Mar', sales: 2000, revenue: 9800 },
    { month: 'Apr', sales: 2780, revenue: 3908 },
    { month: 'May', sales: 1890, revenue: 4800 },
    { month: 'Jun', sales: 2390, revenue: 3800 }
  ];

  const dataToDisplay = csvData.length > 0 ? csvData : sampleData;
  const columns = dataToDisplay.length > 0 ? Object.keys(dataToDisplay[0]) : [];

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="header-content">
          <h1 className="main-title">📊 Data Visualization Dashboard</h1>
          <p className="subtitle">Upload and analyze your CSV data with interactive charts</p>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-icon">📁</div>
          <h2>Upload CSV File</h2>
          
          <div className="file-input-wrapper">
            <input
              type="file"
              id="csv-file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isLoading}
              className="file-input"
            />
            <label htmlFor="csv-file" className="file-label">
              {isLoading ? 'Processing...' : 'Choose CSV File or Drag & Drop'}
            </label>
          </div>

          {fileName && !isLoading && (
            <div className="file-loaded">
              <span className="success-icon">✓</span>
              <span>Loaded: <strong>{fileName}</strong></span>
            </div>
          )}

          {hasError && (
            <div className="error-message">
              ✗ Error loading file. Please try again.
            </div>
          )}

          <p className="format-hint">
            <strong>CSV Format:</strong> First row should contain headers<br/>
            Example: month, sales, revenue
          </p>
        </div>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Processing your data...</p>
        </div>
      )}

      {/* Chart Type Selection */}
      {!isLoading && csvData.length > 0 && (
        <div className="chart-controls">
          <label className="chart-type-label">
            <strong>Chart Type:</strong>
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value)}
              className="chart-select"
            >
              <option value="line">📈 Line Chart</option>
              <option value="area">📊 Area Chart</option>
              <option value="bar">📊 Bar Chart</option>
            </select>
          </label>
          {csvData.length > 1 && (
            <label className="stacked-label">
              <input
                type="checkbox"
                checked={isStacked}
                onChange={(e) => setIsStacked(e.target.checked)}
                disabled={chartType === 'bar'}
              />
              <span>Stacked</span>
            </label>
          )}
          {csvData.length > LARGE_DATASET_THRESHOLD && (
            <div className="performance-info">
              ⚡ Large dataset detected ({csvData.length} rows) - Animations disabled for performance
            </div>
          )}
        </div>
      )}

      {/* Chart Display */}
      {!isLoading && csvData.length > 0 && (
        <div className="chart-display-container fadeIn">
          <h2 className="chart-title">Data Visualization</h2>
          <ChartComponent 
            csvData={csvData} 
            chartType={chartType}
            isStacked={isStacked}
            enableAnimations={csvData.length < LARGE_DATASET_THRESHOLD}
          />
        </div>
      )}

      {!isLoading && csvData.length === 0 && !hasError && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>Upload a CSV file to visualize your data</p>
        </div>
      )}
    </div>
  );
}

function ChartComponent({ csvData, chartType, isStacked, enableAnimations }) {
  const columns = useMemo(() => csvData.length > 0 ? Object.keys(csvData[0]) : [], [csvData]);
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  
  // Determine animation settings based on data size
  const animationDuration = enableAnimations ? 1000 : 0;
  const animationEnabled = enableAnimations;
  
  // Format X-axis tick for time-based data
  const formatXAxisTick = (value) => {
    if (typeof value === 'string' && value.length > 20) {
      return value.substring(0, 10);
    }
    return value;
  };
  
  // Format Y-axis numbers with commas for readability
  const formatYAxisTick = (value) => {
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  };

  const commonChartProps = {
    width: '100%',
    height: 500,
    data: csvData,
    margin: { top: 5, right: 30, left: 0, bottom: 50 }
  };

  const commonAxisProps = {
    stroke: '#9ca3af',
    style: { fontSize: '12px' }
  };

  const tooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    padding: '12px'
  };

  return (
    <ResponsiveContainer {...commonChartProps}>
      {chartType === 'area' ? (
        <AreaChart data={csvData} margin={{ top: 5, right: 30, left: 0, bottom: 50 }}>
          <defs>
            {columns.slice(1).map((col, idx) => (
              <linearGradient key={`gradient-${idx}`} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[idx % colors.length]} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={colors[idx % colors.length]} stopOpacity={0.1}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={columns[0]} 
            {...commonAxisProps}
            tickFormatter={formatXAxisTick}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            {...commonAxisProps}
            tickFormatter={formatYAxisTick}
          />
          <Tooltip 
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#1f2937', fontWeight: '600' }}
            formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {columns.slice(1).map((col, idx) => (
            <Area
              key={col}
              type="monotone"
              dataKey={col}
              stroke={colors[idx % colors.length]}
              fill={`url(#gradient-${idx})`}
              strokeWidth={2}
              isAnimationActive={animationEnabled}
              animationDuration={animationDuration}
              stackId={isStacked ? 'stack' : undefined}
            />
          ))}
        </AreaChart>
      ) : chartType === 'bar' ? (
        <BarChart data={csvData} margin={{ top: 5, right: 30, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={columns[0]} 
            {...commonAxisProps}
            tickFormatter={formatXAxisTick}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            {...commonAxisProps}
            tickFormatter={formatYAxisTick}
          />
          <Tooltip 
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#1f2937', fontWeight: '600' }}
            formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {columns.slice(1).map((col, idx) => (
            <Bar
              key={col}
              dataKey={col}
              fill={colors[idx % colors.length]}
              isAnimationActive={animationEnabled}
              animationDuration={animationDuration}
              stackId={isStacked ? 'stack' : undefined}
            />
          ))}
        </BarChart>
      ) : (
        <LineChart data={csvData} margin={{ top: 5, right: 30, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={columns[0]} 
            {...commonAxisProps}
            tickFormatter={formatXAxisTick}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            {...commonAxisProps}
            tickFormatter={formatYAxisTick}
          />
          <Tooltip 
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#1f2937', fontWeight: '600' }}
            formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {columns.slice(1).map((col, idx) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={csvData.length <= 100}
              activeDot={csvData.length <= 500 ? { r: 6 } : { r: 4 }}
              isAnimationActive={animationEnabled}
              animationDuration={animationDuration}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

// Memoize the chart component to prevent unnecessary re-renders
export const MemoizedChartComponent = memo(ChartComponent);