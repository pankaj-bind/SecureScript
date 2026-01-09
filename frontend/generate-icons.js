// Script to generate app icons from SVG using sharp
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const svgPath = path.join(__dirname, 'build-resources', 'icon.svg');
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  
  console.log('Generating PNG icons from SVG...');
  
  try {
    // Generate PNG files for each size
    for (const size of sizes) {
      const pngPath = path.join(__dirname, 'build-resources', `icon-${size}x${size}.png`);
      
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      
      console.log(`✓ Generated ${size}x${size} icon`);
    }
    
    // Generate the main icon.png (256x256 for electron)
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(path.join(__dirname, 'build-resources', 'icon.png'));
    
    console.log('✓ Generated icon.png (256x256)');
    
    // Generate ICO file for Windows using dynamic import
    const pngToIcoModule = await import('png-to-ico');
    const pngToIco = pngToIcoModule.default;
    const png256 = path.join(__dirname, 'build-resources', 'icon-256x256.png');
    const icoBuffer = await pngToIco([png256]);
    fs.writeFileSync(path.join(__dirname, 'build-resources', 'icon.ico'), icoBuffer);
    console.log('✓ Generated icon.ico for Windows');
    
    console.log('\n✅ Icon generation complete!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
