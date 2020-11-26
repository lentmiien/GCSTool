const BinPacking3D = require('binpackingjs').BP3D;
const { Item, Bin, Packer } = BinPacking3D;

// Run for every connection (verify/log users, etc.)
exports.all = function (req, res, next) {
  next();
};

// Landing page
exports.index = (req, res) => {
  res.render('binpackindex');
};

// Back to landing page
exports.back = (req, res) => {
  res.redirect('/binpack');
};

// Box templates
const boxTemplates = {
  'AA': [256, 181, 45],
  'A': [256, 181, 112],
  'BM': [305, 188, 142],
  'FM': [275, 193, 165],
  'F3': [346, 226, 120],
  'M1.5L': [310, 253, 187],
  '333': [377, 259, 139],
  'B4': [383, 260, 220],
  '999': [335, 281, 228],
  '777': [393, 322, 155],
  '222': [358, 334, 187],
  '888': [568, 220, 75],
  'Tapecho': [800, 148, 113],
  'L2': [430, 317, 296],
  'B1': [533, 375, 153],
  'X1': [606, 421, 174],
  'B3': [544, 364, 287],
  'Tapedai': [750, 432, 167],
  'X2': [597, 421, 347],
  'X3': [719, 440, 380],
  'X5': [741, 593, 381],
  'X4': [1110, 417, 378],
  '81': [1100, 270, 133],
};

// Pack a box
exports.packbox = (req, res) => {
  // Aquire safety setting
  const safety = parseFloat(req.body.safety);

  // Boxes
  let bins = [];
  const boxSize = boxTemplates[req.body.selectbox];
  bins.push(new Bin(req.body.selectbox, boxSize[0]*safety, boxSize[1]*safety, boxSize[2]*safety, 100000));

  // Items
  let items = [];
  const itemdata = req.body.provideitems.split('\r\n');
  for(let x = 1; x < itemdata.length; x += 2) {
    const count = parseInt(itemdata[x]);
    for(let i = 0; i < count; i++) {
      const itemdetails = itemdata[x-1].split(' ');
      const itemCode = itemdetails[0];
      const itemWeight = parseFloat(itemdetails[1].split('kg')[0]) * 1000;
      const itemSize = itemdetails.length == 3 ? itemdetails[1].split('kg_')[1].split('×') : itemdetails[2].split('×');
      items.push(new Item(itemCode, parseInt(itemSize[0]), parseInt(itemSize[1]), parseInt(itemSize[2]), itemWeight));
    }
  }

  items.sort((a, b) => {
    if(a.getVolume() > b.getVolume()) return -1;
    if(a.getVolume() < b.getVolume()) return 1;
    return 0;
  });

  // Pack robot
  let packer = new Packer();

  // Give boxes and items to pack robot
  bins.forEach(bin => packer.addBin(bin));
  items.forEach(item => packer.addItem(item));

  // Pack items into the bins
  packer.pack();

  // Display results
  res.render('packresult', { packer, safety });
};

// Pack multiple boxes
exports.packboxes = (req, res) => {
  // Aquire safety setting
  const safety = parseFloat(req.body.safety);

  // Boxes
  let binpool = req.body.selectbox.split(',');
  const bins = [];

  // Items
  const items = [];
  const itemdata = req.body.provideitems.split('\r\n');
  for(let x = 1; x < itemdata.length; x += 2) {
    const count = parseInt(itemdata[x]);
    for(let i = 0; i < count; i++) {
      const itemdetails = itemdata[x-1].split(' ');
      const itemCode = itemdetails[0];
      const itemWeight = parseFloat(itemdetails[1].split('kg')[0]) * 1000;
      const itemSize = itemdetails.length == 3 ? itemdetails[1].split('kg_')[1].split('×') : itemdetails[2].split('×');
      items.push(new Item(itemCode, parseInt(itemSize[0]), parseInt(itemSize[1]), parseInt(itemSize[2]), itemWeight));
    }
  }

  // Start with largest items (volume)
  items.sort((a, b) => {
    if(a.getVolume() > b.getVolume()) return -1;
    if(a.getVolume() < b.getVolume()) return 1;
    return 0;
  });

  // Pack robot
  let packer = new Packer();

  // Give boxes and items to pack robot
  bins.forEach(bin => packer.addBin(bin));
  items.forEach(item => packer.addItem(item));

  // The magic loop!
  let lastRemainingItems = 0;
  while(packer.items.length > 0 && packer.items.length != lastRemainingItems) {
    lastRemainingItems = packer.items.length;

    // Try to fit the remaining items in all the bins in the bin pool,
    // as well as determining which bin that is best to use next
    let bestBin = 0;
    let bestBinFillRate = 0;
    let bestBinTotalItemVolume = 0;
    let bestBinWastedSpace = 9999999999999;
    binpool.forEach(binID => {
      const testBins = [];
      testBins.push(new Bin(binID, boxTemplates[binID][0]*safety, boxTemplates[binID][1]*safety, boxTemplates[binID][2]*safety, 100000));
      
      let testPacker = new Packer();
      testBins.forEach(bin => testPacker.addBin(bin));
      packer.items.forEach(item => testPacker.addItem(item));

      testPacker.pack();

      let binFillRate = 0;
      let binTotalItemVolume = 0;
      testPacker.bins[0].items.forEach(i => binTotalItemVolume += i.getVolume());
      binFillRate = binTotalItemVolume / testPacker.bins[0].getVolume();
      let binWastedSpace = testPacker.bins[0].getVolume() - binTotalItemVolume;

      switch(req.body.strategy) {
        case 'fewest_number_of_boxes':
          if(
            binTotalItemVolume > bestBinTotalItemVolume ||
            (binTotalItemVolume == bestBinTotalItemVolume && binFillRate > bestBinFillRate)
            ) {
            bestBin = binID;
            bestBinFillRate = binFillRate;
            bestBinTotalItemVolume = binTotalItemVolume;
            bestBinWastedSpace = binWastedSpace;
          }
          break;
        case 'best_fillup_rate':
          if(binFillRate > bestBinFillRate) {
            bestBin = binID;
            bestBinFillRate = binFillRate;
            bestBinTotalItemVolume = binTotalItemVolume;
            bestBinWastedSpace = binWastedSpace;
          }
          break;
        case 'smallest_wasted_space':
          if(binWastedSpace < bestBinWastedSpace && binTotalItemVolume > 0) {
            bestBin = binID;
            bestBinFillRate = binFillRate;
            bestBinTotalItemVolume = binTotalItemVolume;
            bestBinWastedSpace = binWastedSpace;
          }
          break;
        default: // Every box is the best box!
          bestBin = binID;
      }
    });
    
    // Check if any "best bin" was found
    if(bestBin != 0) {
      bins.push(new Bin(bestBin, boxTemplates[bestBin][0]*safety, boxTemplates[bestBin][1]*safety, boxTemplates[bestBin][2]*safety, 100000));
      packer.addBin(bins[bins.length-1]);
      packer.pack();

      // Return unpacked items to item pool
      while(packer.unfitItems.length > 0) {
        packer.items.push(packer.unfitItems.splice(0, 1)[0]);
      }
    }
  }

  // Pack items into the bins
  packer.pack();

  // Display results
  res.render('packresult', { packer, safety });
};
