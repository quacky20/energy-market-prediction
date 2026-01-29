import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import Papa from 'papaparse';

export default function EnergyPrice() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);

  useEffect(() => {
    // Fetch CSV from backend API
    fetch('http://localhost:5000/api/optimize/results/battery')
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
            // Group by date and calculate average price per day
            const groupedByDate = {};
            results.data.forEach(item => {
              const date = item.datetime ? item.datetime.split(' ')[0] : 'N/A'; // Extract YYYY-MM-DD
              
              if (!groupedByDate[date]) {
                groupedByDate[date] = {
                  date,
                  totalPrice: 0,
                  count: 0
                };
              }
              
              const price = parseFloat(item.price) || 0;
              groupedByDate[date].totalPrice += price;
              groupedByDate[date].count += 1;
            });

            // Convert to array and calculate daily averages
            const dailyData = Object.values(groupedByDate)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(day => ({
                date: day.date,
                price: day.count > 0 ? (day.totalPrice / day.count).toFixed(2) : 0
              }));

            const prices = dailyData.map(d => parseFloat(d.price));
            const max = Math.max(...prices, 300);
            const min = Math.min(...prices, -50);

            setMaxPrice(max);
            setMinPrice(min);
            setData(dailyData);
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
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '50px',
        textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize: '20px', color: '#f59e0b' }}>⏳ Loading data...</div>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '50px',
        textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize: '18px', color: '#dc2626' }}>❌ {error || 'No data available'}</div>
      </div>
    );
  }

  const avgPrice = (data.reduce((sum, d) => sum + parseFloat(d.price), 0) / data.length).toFixed(2);

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <TrendingUp size={24} style={{ color: '#f59e0b' }} />
        <div>
          <h2 style={{ margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
            Energy Price Over Time
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '12px' }}>
            Daily average price ($/MWh)
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: '#fffbeb',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #f59e0b'
        }}>
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Average Price
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
            ${avgPrice}
          </div>
        </div>

        <div style={{
          background: '#dcfce7',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #10b981'
        }}>
          <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Min Price
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
            ${minPrice.toFixed(2)}
          </div>
        </div>

        <div style={{
          background: '#fee2e2',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #ef4444'
        }}>
          <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Max Price
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>
            ${maxPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={Math.floor(data.length / 10) || 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
            domain={[-50, 300]}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.85)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px'
            }}
            formatter={(value) => `$${parseFloat(value).toFixed(2)}/MWh`}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          <ReferenceLine
            y={0}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{ value: '$0', position: 'right', fill: '#6b7280', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            name="Daily Avg Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

