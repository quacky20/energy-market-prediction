import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, Target } from 'lucide-react';
import Papa from 'papaparse';

export default function ProfitPie() {
  const [chartData, setChartData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch CSV from assets folder
    fetch('/src/assets/results_pnl_by_product.csv')
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch data');
        return response.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              // Map CSV data to chart format
              const colors = ['#0066cc', '#00cc88', '#0099ff', '#ff9900', '#ff6b6b'];
              const data = results.data.map((row, idx) => ({
                name: row.product || 'Unknown',
                value: parseFloat(row.pnl) || 0,
                color: colors[idx % colors.length],
              })).sort((a, b) => b.value - a.value);

              const totalValue = data.reduce((sum, item) => sum + item.value, 0);
              setChartData(data);
              setTotal(totalValue);
            }
            setLoading(false);
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            setError('Failed to parse CSV data');
            setLoading(false);
          }
        });
      })
      .catch(error => {
        console.error('Failed to load CSV:', error);
        setError('Failed to load profit data');
        setLoading(false);
      });
  }, []);

  const formatCurrency = (v) =>
    `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#999', fontSize: '16px' }}>Loading profit data...</div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#d32f2f', fontSize: '16px' }}>{error || 'No data available'}</div>
      </div>
    );
  }

  // Calculate energy vs ancillary split
  const energyProduct = chartData.find(item => item.name === 'SP15');
  const energyProfit = energyProduct ? energyProduct.value : 0;
  const ancillaryProfit = total - energyProfit;
  const ancillaryPct = ((ancillaryProfit / total) * 100).toFixed(1);

  return (
    <div style={{
      background: '#f8fafc',
      minHeight: '100vh',
      padding: '40px 20px',
      fontFamily: 'Segoe UI, Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}>
          
          {/* Header */}
          <div style={{
            padding: '30px 40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <TrendingUp size={28} />
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>
                Revenue Breakdown
              </h1>
            </div>
            <p style={{ margin: '0', opacity: 0.9, fontSize: '14px' }}>
              Optimization Results
            </p>
          </div>

          {/* Content */}
          <div style={{ padding: '40px' }}>
            
            {/* Charts Container */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '40px',
              marginBottom: '40px'
            }}>
              
              {/* Pie Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{
                        background: 'rgba(0, 0, 0, 0.8)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend & Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                
                {/* Legend */}
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    color: '#1f2937', 
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Revenue Sources
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {chartData.map((item) => {
                      const pct = ((item.value / total) * 100).toFixed(1);
                      return (
                        <div key={item.name} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          borderRadius: '8px',
                          background: '#f9fafb',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f4ff';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                        >
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: item.color,
                            flexShrink: 0
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#374151',
                              marginBottom: '2px'
                            }}>
                              {item.name}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#9ca3af'
                            }}>
                              {pct}% of total
                            </div>
                          </div>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#111827',
                            whiteSpace: 'nowrap'
                          }}>
                            {formatCurrency(item.value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total */}
                <div style={{
                  paddingTop: '20px',
                  borderTop: '2px solid #e5e7eb'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Total Revenue
                    </div>
                    <div style={{
                      fontSize: '22px',
                      fontWeight: '700',
                      color: '#667eea'
                    }}>
                      {formatCurrency(total)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Insight */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
              borderRadius: '12px',
              borderLeft: '4px solid #667eea',
              display: 'flex',
              gap: '12px'
            }}>
              <Target size={20} style={{ color: '#667eea', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '4px'
                }}>
                  Ancillary Services Dominance
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.5'
                }}>
                  Ancillary services (Reg Down, Reg Up, Spin, Non-Spin) contribute <strong>{ancillaryPct}%</strong> of total revenue. This indicates the battery is primarily monetized for grid support rather than energy arbitrage.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginTop: '30px'
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '500' }}>
              HIGHEST REVENUE
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#667eea' }}>
              {chartData.length > 0 ? chartData[0].name : 'N/A'}
            </div>
            <div style={{ fontSize: '14px', color: '#374151', marginTop: '4px', fontWeight: '600' }}>
              {chartData.length > 0 ? formatCurrency(chartData[0].value) : '$0'}
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '500' }}>
              ENERGY ARBITRAGE
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00cc88' }}>
              {((energyProfit / total) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '14px', color: '#374151', marginTop: '4px', fontWeight: '600' }}>
              {formatCurrency(energyProfit)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}