import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Axios from "axios";

const ExcelDownloadComponent = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await Axios.get(
          "http://localhost:3001/fullCollection",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setData(response.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchAllData();
  }, []);

  const handleDownloadExcel = () => {
    if (data.length === 0) {
      console.error("No data to export");
      return;
    }

    // Filter data to include only title and author
    const filteredData = data.map(({ title, author }) => ({ title, author }));

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert filtered data to worksheet
    const ws = XLSX.utils.json_to_sheet(filteredData);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Generate the XLSX file
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    // Save the file using FileSaver.js
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "data.xlsx"
    );
  };

  return (
    <div>
      <button
        className="w-15 flex my-2 mx-2 items-center justify-center px-2 py-1 text-xs  font-small  rounded-md text-purple-700 bg-purple-100 hover:bg-purple-50 hover:text-purple-600 focus:ring ring-offset-2 ring-purple-100 focus:outline-none transition duration-150 ease-in-out "
        onClick={handleDownloadExcel}
      >
        Exe
      </button>
    </div>
  );
};

export default ExcelDownloadComponent;
