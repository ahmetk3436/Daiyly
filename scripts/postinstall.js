const fs = require('fs');
const path = require('path');

// Patch expo-localization for Xcode 26 compatibility
// Fixes "switch must be exhaustive" error in LocalizationModule.swift
const localizationFile = path.join(
  __dirname, '..', 'node_modules', 'expo-localization', 'ios', 'LocalizationModule.swift'
);

if (fs.existsSync(localizationFile)) {
  let content = fs.readFileSync(localizationFile, 'utf8');
  if (!content.includes('@unknown default')) {
    content = content.replace(
      /case \.iso8601:\s*\n\s*return "iso8601"\s*\n\s*\}/,
      'case .iso8601:\n      return "iso8601"\n    @unknown default:\n      return "gregory"\n    }'
    );
    fs.writeFileSync(localizationFile, content);
    console.log('  Patched expo-localization (Xcode 26 switch fix)');
  } else {
    console.log('  expo-localization already patched');
  }
} else {
  console.log('  expo-localization not found, skipping patch');
}
