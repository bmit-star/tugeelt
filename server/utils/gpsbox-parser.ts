import fs from "fs";

// Let's create a parser for the GPSBOX HTML report
export interface GPSBoxDayRecord {
  date: string;
  startTime: string;
  endTime: string;
  movingTime: string;
  distanceKm: number;
  fuelLiters: number;
  fuelAvg100Km: number;
  engineHours: string;
}

export interface GPSBoxVehicleReport {
  plate: string;
  records: GPSBoxDayRecord[];
  totalDistanceKm: number;
  totalFuelLiters: number;
}
