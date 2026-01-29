import './App.css'

import React from 'react'
import ChartCSVTutorial from './components/visualizeTradesReserves.jsx'
import EnergyVisualization from './components/energyTradeVisualize.jsx'
import Dashboard from './components/Dashboard.jsx'
import Footer from './components/Footer'
import Homepage from './components/Homepage'
import Navbar from './components/Navbar'
import { OptimizationProvider } from './context/OptimizationContext'
import Upload from './components/Upload'
import ProfitPie from './components/profitPie.jsx'

// import TradeAndReserves from './components/graphs/Reserves.jsx'
// import BatterySOC from './components/graphs/StateOfCharge.jsx'
// import EnergyPrice from './components/graphs/EnergyPrice.jsx'
function App() {

  return (
    <>
      {/* <div className="pt-50"> */}
      <OptimizationProvider>

        {/* <ChartCSVTutorial /> */}
        {/* <EnergyVisualization /> */}
        {/* <Dashboard /> */}


        {/* <TradeAndReserves/>
      <BatterySOC/> */}
        {/* <EnergyPrice/> */}
        {/* <ProfitPie /> */}
        <Navbar />
        <Homepage />
        <Footer />
      </OptimizationProvider>

      {/* </div> */}
    </>
  )
}

export default App
