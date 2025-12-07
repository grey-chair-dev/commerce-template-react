/**
 * Neon Database Health Monitor
 * 
 * Monitors Neon database health and sends Slack alerts when thresholds are breached.
 * 
 * Usage:
 *   node scripts/monitor-neon-health.js
 * 
 * This script can be run:
 * - Manually for testing
 * - Via cron job for periodic monitoring
 * - Via external monitoring service (UptimeRobot, Datadog, etc.)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const baseUrl = process.env.VITE_API_URL || 'http://localhost:3000';

async function monitorNeonHealth() {
  console.log('🔍 Monitoring Neon Database Health');
  console.log('='.repeat(60));
  
  try {
    // POST to trigger health check and send alerts if needed
    const response = await fetch(`${baseUrl}/api/monitoring/neon-health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const healthStatus = await response.json();
    
    console.log('\n📊 Health Status:');
    console.log(`  Overall: ${healthStatus.overall.toUpperCase()}`);
    console.log(`  Timestamp: ${healthStatus.timestamp}`);
    
    console.log('\n🔌 Connection Pool:');
    if (healthStatus.connectionPool.error) {
      console.log(`  ❌ Error: ${healthStatus.connectionPool.error}`);
    } else {
      console.log(`  Active: ${healthStatus.connectionPool.active}`);
      console.log(`  Max: ${healthStatus.connectionPool.max}`);
      console.log(`  Usage: ${healthStatus.connectionPool.percentage}%`);
      console.log(`  Status: ${healthStatus.connectionPool.status === 'critical' ? '🔴 CRITICAL' : '✅ Healthy'}`);
    }
    
    console.log('\n⚡ Query Latency:');
    if (healthStatus.queryLatency.error) {
      console.log(`  ❌ Error: ${healthStatus.queryLatency.error}`);
    } else {
      console.log(`  Latency: ${healthStatus.queryLatency.latencyMs}ms`);
      console.log(`  Status: ${healthStatus.queryLatency.status === 'slow' ? '🟡 SLOW' : '✅ Healthy'}`);
      console.log(`  Rows Returned: ${healthStatus.queryLatency.rowsReturned}`);
    }
    
    if (healthStatus.alerts.length > 0) {
      console.log('\n🚨 Alerts Triggered:');
      healthStatus.alerts.forEach((alert, index) => {
        console.log(`  ${index + 1}. ${alert.priority === 'high' ? '🔴 HIGH' : '🟡 MEDIUM'} - ${alert.resource}`);
        console.log(`     ${alert.message}`);
      });
      console.log('\n✅ Slack alerts sent (if configured)');
    } else {
      console.log('\n✅ No alerts - all metrics within thresholds');
    }
    
    return healthStatus;
  } catch (error) {
    console.error('\n❌ Monitoring failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure Vercel dev server is running:');
      console.error('   vercel dev --listen 3000');
    }
    process.exit(1);
  }
}

monitorNeonHealth().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

