import React from 'react'

function Navbar() {
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };
    
    return (
        <nav className='fixed top-0 left-0 w-full h-20 shadow-md z-50 flex items-center justify-between px-8 text-white bg-linear-to-r from-teal-800/80 to-cyan-800/80 backdrop-blur-lg font-geist'>
            <h1 className='text-2xl font-bold select-none'>NRG Market</h1>
            <ul className='flex gap-6 text-lg font-bold'>
                <li><button onClick={() => scrollToSection('home')} className='hover:scale-110 transition-all duration-150'>Home</button></li>
                <li><button onClick={() => scrollToSection('analytics')} className='hover:scale-110 transition-all duration-150'>Analytics</button></li>
                <li><button onClick={() => scrollToSection('upload')} className='hover:scale-110 transition-all duration-150'>Upload</button></li>
            </ul>
        </nav>
    )
}

export default Navbar