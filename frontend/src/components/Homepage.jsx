import React from 'react'
import Hero from './Hero.jsx';
import Analytics from './Analytics.jsx';
import Upload from './Upload.jsx';

function Homepage() {
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className='min-h-screen font-geist'>
            {/* hero */}
            <section id='home' className='min-h-screen flex items-center justify-center bg-linear-to-br from-teal-50 to-cyan-100 pt-20'>
                <Hero />
            </section>

            {/* analytics */}
            <section id='analytics' className='min-h-screen flex items-center justify-center bg-white py-20'>
                <Analytics />
            </section>

            {/* upload */}
            <section id='upload' className='min-h-screen flex items-center justify-center bg-teal-50 py-20'>
                <Upload />
            </section>
        </div>
    )
}

export default Homepage