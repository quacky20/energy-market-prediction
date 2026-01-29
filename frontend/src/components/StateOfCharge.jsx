import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Battery } from 'lucide-react';
import Papa from 'papaparse';

export default function BatterySOC() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch CSV from backend API
    fetch('http://localhost:5000/api/optimize/results/soc')
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
            // Group by date and calculate average SOC per day
            const groupedByDate = {};
            results.data.forEach(item => {
              const date = item.datetime ? item.datetime.split(' ')[0] : 'N/A'; // Extract YYYY-MM-DD
              
              if (!groupedByDate[date]) {
                groupedByDate[date] = {
                  date,
                  totalSOC: 0,
                  count: 0
                };
              }
              
              const soc = parseFloat(item.soc) || 0;
              groupedByDate[date].totalSOC += soc;
              groupedByDate[date].count += 1;
            });

            // Convert to array and calculate daily averages
            const dailyData = Object.values(groupedByDate)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(day => ({
                date: day.date,
                soc: day.count > 0 ? (day.totalSOC / day.count).toFixed(2) : 0
              }));

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
        <div style={{ fontSize: '20px', color: '#3b82f6' }}>⏳ Loading data...</div>
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

  const minSOC = Math.min(...data.map(d => parseFloat(d.soc)));
  const maxSOC = Math.max(...data.map(d => parseFloat(d.soc)));
  const avgSOC = (data.reduce((sum, d) => sum + parseFloat(d.soc), 0) / data.length).toFixed(1);

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Battery size={24} style={{ color: '#3b82f6' }} />
        <div>
          <h2 style={{ margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
            Battery State of Charge (SOC)
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '12px' }}>
            Daily average SOC over time
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
          background: '#eff6ff',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #3b82f6'
        }}>
          <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Average SOC
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
            {avgSOC}%
          </div>
        </div>

        <div style={{
          background: '#eff6ff',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #1e40af'
        }}>
          <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Min SOC
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e40af' }}>
            {minSOC.toFixed(1)}%
          </div>
        </div>

        <div style={{
          background: '#eff6ff',
          padding: '14px',
          borderRadius: '8px',
          borderLeft: '3px solid #0284c7'
        }}>
          <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
            Max SOC
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0284c7' }}>
            {maxSOC.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorSOC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={Math.floor(data.length / 10) || 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            label={{ value: 'SOC (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.85)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px'
            }}
            formatter={(value) => `${parseFloat(value).toFixed(2)}%`}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Area
            type="monotone"
            dataKey="soc"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorSOC)"
            name="State of Charge"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}