function drawBrandMark(context, width, height, accent = '#7be7d8', placement = 'bottom-right') {
  const scale = Math.max(0.72, Math.min(1.35, Math.min(width, height) / 320));
  const size = 20 * scale;
  const brand = 'dev.splosh';
  context.save();
  context.font = `bold ${size}px BotFont, sans-serif`;
  const textWidth = context.measureText(brand).width;
  const badgeWidth = textWidth + size * 3.45;
  const badgeHeight = size * 2.2;
  const left = placement.endsWith('left') ? 26 * scale : width - badgeWidth - 26 * scale;
  const top = placement.startsWith('top') ? 22 * scale : height - badgeHeight - 22 * scale;
  const radius = badgeHeight / 2;

  context.globalAlpha = 0.97;
  context.shadowColor = 'rgba(0, 0, 0, 0.55)';
  context.shadowBlur = 18 * scale;
  context.shadowOffsetY = 4 * scale;
  context.beginPath();
  context.roundRect(left, top, badgeWidth, badgeHeight, radius);
  context.fillStyle = 'rgba(5, 16, 27, 0.94)';
  context.fill();
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.strokeStyle = `${accent}bb`;
  context.lineWidth = Math.max(1, scale * 1.4);
  context.stroke();

  const iconRadius = size * 0.69;
  const iconX = left + radius;
  const iconY = top + radius;
  const iconFill = context.createLinearGradient(iconX - iconRadius, iconY - iconRadius, iconX + iconRadius, iconY + iconRadius);
  iconFill.addColorStop(0, '#b8fff3');
  iconFill.addColorStop(1, accent);
  context.beginPath();
  context.arc(iconX, iconY, iconRadius, 0, Math.PI * 2);
  context.fillStyle = iconFill;
  context.fill();

  context.fillStyle = '#08202a';
  context.font = `bold ${size * 0.92}px BotFont, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('D', iconX, iconY + size * 0.025);

  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.font = `bold ${size}px BotFont, sans-serif`;
  context.fillStyle = '#f5fffd';
  context.fillText(brand, left + radius * 1.9, iconY);
  context.restore();
}

function drawBrandFrame(context, width, height, accent = '#7be7d8') {
  const inset = Math.max(10, Math.min(width, height) * 0.035);
  const radius = Math.max(12, inset * 0.7);
  context.save();
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.004);
  context.strokeStyle = `${accent}a8`;
  context.beginPath();
  context.roundRect(inset, inset, width - inset * 2, height - inset * 2, radius);
  context.stroke();
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.002);
  context.strokeStyle = 'rgba(255, 255, 255, 0.17)';
  context.beginPath();
  context.roundRect(inset + 7, inset + 7, width - (inset + 7) * 2, height - (inset + 7) * 2, radius * 0.72);
  context.stroke();
  context.restore();
}

function svgBrandMark(width, height, accent = '#7be7d8', placement = 'bottom-right') {
  const scale = Math.min(1, Math.max(0.65, height / 460));
  const badgeWidth = 196 * scale;
  const badgeHeight = 48 * scale;
  const margin = 20 * scale;
  const x = placement.endsWith('left') ? margin : width - badgeWidth - margin;
  const y = placement.startsWith('top') ? margin : height - badgeHeight - margin;
  return `<g opacity=".97"><rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="#06131f" fill-opacity=".9" stroke="${accent}" stroke-opacity=".85" stroke-width="1.5"/><circle cx="${x + badgeHeight / 2}" cy="${y + badgeHeight / 2}" r="${badgeHeight * .31}" fill="${accent}"/><text x="${x + badgeHeight / 2}" y="${y + badgeHeight * .69}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${badgeHeight * .53}" font-weight="700" fill="#08202a">D</text><text x="${x + badgeHeight * 1.06}" y="${y + badgeHeight * .65}" font-family="Arial,sans-serif" font-size="${badgeHeight * .4}" font-weight="700" fill="#f5fffd">dev.splosh</text></g>`;
}

module.exports = { drawBrandMark, drawBrandFrame, svgBrandMark };
