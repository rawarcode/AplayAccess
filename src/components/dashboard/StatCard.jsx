import React from 'react';

const StatCard = ({ icon, iconColor, title, value, change, trend }) => {
  const trendClass = trend === 'up' ? 'up' : 'down';

  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <div className={`stat-card-icon ${iconColor}`}>
          <i className={icon}></i>
        </div>
        <div>
          <p className="stat-card-title">{title}</p>
          <h3 className="stat-card-value">{value}</h3>
          <p className={`stat-card-change ${trendClass}`}>{change}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
