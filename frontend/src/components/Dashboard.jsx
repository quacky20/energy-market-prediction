import React, { useContext } from 'react'
import { OptimizationContext } from '../context/OptimizationContext'
import ProfitPie from './profitPie'
import StateOfCharge from './StateOfCharge'
import Reserves from './Reserves'

export default function Dashboard() {
  const { optimizationData } = useContext(OptimizationContext);

  return (
    <div style={{ padding: '40px 20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '30px', color: '#1f2937' }}>
          Optimization Results
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '30px'
        }}>
          <ProfitPie />
          <StateOfCharge />
          <Reserves />
        </div>
      </div>
    </div>
  )
}