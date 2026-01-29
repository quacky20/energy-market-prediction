import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Activity } from 'lucide-react';
import Papa from 'papaparse';

export default function TradeAndReserves() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxCommitment, setMaxCommitment] = useState(0);

  useEffect(() => {
    // Update the path to your CSV file location
    fetch('/results_trades_and_reserves.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            // Filter for ancillary services only
            const ancillaryServices = ['RegUp', 'RegDown', 'Spin', 'NonSpin'];
            
            const filteredData = results.data.filter(item => item.product && ancillaryServices.includes(item.product));
            
            // Group by date and product
            const groupedByDate = {};
            filteredData.forEach(item => {
              const date = item.datetime ? item.datetime.split(' ')[0] : 'N/A'; // Extract YYYY-MM-DD
              
              if (!groupedByDate[date]) {
                groupedByDate[date] = {
                  date,
                  RegUp: 0,
                  RegDown: 0,
                  Spin: 0,
                  NonSpin: 0,
                  counts: {
                    RegUp: 0,
                    RegDown: 0,
                    Spin: 0,
                    NonSpin: 0
                  }
                };
              }
              
              const commitment = parseFloat(item.commitment_mw) || 0;
              groupedByDate[date][item.product] += commitment;
              groupedByDate[date].counts[item.product] += 1;
            });
            
            // Convert to array and calculate daily averages
            const ancillaryData = Object.values(groupedByDate)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(day => ({
                date: day.date,
                RegUp: day.counts.RegUp > 0 ? day.RegUp / day.counts.RegUp : 0,
                RegDown: day.counts.RegDown > 0 ? day.RegDown / day.counts.RegDown : 0,
                Spin: day.counts.Spin > 0 ? day.Spin / day.counts.Spin : 0,
                NonSpin: day.counts.NonSpin > 0 ? day.NonSpin / day.counts.NonSpin : 0
              }));

            const max = Math.max(
              ...ancillaryData.map(d => Math.max(d.RegUp, d.RegDown, d.Spin, d.NonSpin)),
              0
            );
            setMaxCommitment(max);
            console.log('Ancillary Service Data (By Product):', ancillaryData);
            setData(ancillaryData);
            setLoading(false);
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            setLoading(false);
          }
        });
      })
      .catch(error => {
        console.error('Failed to load CSV:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ color: '#999', padding: '20px' }}>Loading...</div>;
  if (!data || data.length === 0) return <div style={{ color: '#999', padding: '20px' }}>No ancillary service data available</div>;

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Activity size={24} style={{ color: '#06b6d4' }} />
        <div>
          <h2 style={{ margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
            Ancillary Services Commitment
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '12px' }}>
            Commitment over time (MW)
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#fce7f3', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #ec4899' }}>
          <div style={{ fontSize: '10px', color: '#831843', fontWeight: '600', marginBottom: '4px' }}>REG UP</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#ec4899' }}>
            {maxCommitment > 0 ? (data.reduce((max, d) => Math.max(max, d.RegUp), 0)).toFixed(2) : '0'} MW
          </div>
        </div>
        <div style={{ background: '#fef3c7', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '10px', color: '#78350f', fontWeight: '600', marginBottom: '4px' }}>REG DOWN</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>
            {maxCommitment > 0 ? (data.reduce((max, d) => Math.max(max, d.RegDown), 0)).toFixed(2) : '0'} MW
          </div>
        </div>
        <div style={{ background: '#ccfbf1', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #14b8a6' }}>
          <div style={{ fontSize: '10px', color: '#134e4a', fontWeight: '600', marginBottom: '4px' }}>SPIN</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#14b8a6' }}>
            {maxCommitment > 0 ? (data.reduce((max, d) => Math.max(max, d.Spin), 0)).toFixed(2) : '0'} MW
          </div>
        </div>
        <div style={{ background: '#ede9fe', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: '10px', color: '#4c1d95', fontWeight: '600', marginBottom: '4px' }}>NON-SPIN</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#8b5cf6' }}>
            {maxCommitment > 0 ? (data.reduce((max, d) => Math.max(max, d.NonSpin), 0)).toFixed(2) : '0'} MW
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={Math.floor(data.length / 10) || 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            label={{ value: 'Commitment (MW)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.9)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              padding: '10px'
            }}
            formatter={(value) => `${value.toFixed(2)} MW`}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line
            type="monotone"
            dataKey="RegUp"
            stroke="#ec4899"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            name="RegUp (Reg Up)"
          />
          <Line
            type="monotone"
            dataKey="RegDown"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            name="RegDown (Reg Down)"
          />
          <Line
            type="monotone"
            dataKey="Spin"
            stroke="#14b8a6"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            name="Spin (Spinning Reserve)"
          />
          <Line
            type="monotone"
            dataKey="NonSpin"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            name="NonSpin (Non-Spinning)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}