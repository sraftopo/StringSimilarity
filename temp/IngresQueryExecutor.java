import java.sql.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public class IngresQueryExecutor {
    public static void main(String[] args) {
        if (args.length < 6) {
            System.err.println("Usage: java IngresQueryExecutor <host> <port> <schema> <username> <password> <query_or_file> [is_file]");
            System.exit(1);
        }
        
        String host = args[0];
        String port = args[1];
        String schema = args[2];
        String username = args[3];
        String password = args[4];
        String queryOrFile = args[5];
        boolean isFile = args.length > 6 && "true".equalsIgnoreCase(args[6]);
        
        String query;
        if (isFile) {
            try {
                query = new String(Files.readAllBytes(Paths.get(queryOrFile)), "UTF-8");
            } catch (Exception e) {
                JSONObject error = new JSONObject();
                error.put("success", false);
                error.put("error", "Failed to read query file: " + e.getMessage());
                System.err.println(error.toString());
                System.exit(1);
                return;
            }
        } else {
            query = queryOrFile;
        }
        
        String url = "jdbc:ingres://" + host + ":" + port + "/" + schema + ";char_encode=GREEK";
        
        // Set system properties for UTF-8 encoding to handle Greek characters
        System.setProperty("file.encoding", "UTF-8");
        
        try {
            Class.forName("com.ingres.jdbc.IngresDriver");
            
            // Create connection properties with explicit character encoding
            java.util.Properties props = new java.util.Properties();
            props.setProperty("user", username);
            props.setProperty("password", password);
            props.setProperty("char_encode", "GREEK");
            // Note: Ingres uses ISO-8859-7 for GREEK encoding
            
            Connection conn = DriverManager.getConnection(url, props);
            
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            ResultSetMetaData rsmd = rs.getMetaData();
            int columnCount = rsmd.getColumnCount();
            
            JSONArray results = new JSONArray();
            
            while (rs.next()) {
                JSONObject row = new JSONObject();
                for (int i = 1; i <= columnCount; i++) {
                    String columnName = rsmd.getColumnName(i);
                    int columnType = rsmd.getColumnType(i);
                    
                    // Handle different data types and ensure proper encoding for Greek characters
                    // For character types, read as bytes to preserve GREEK encoding (ISO-8859-7)
                    if (columnType == java.sql.Types.VARCHAR || columnType == java.sql.Types.CHAR || 
                        columnType == java.sql.Types.LONGVARCHAR || columnType == java.sql.Types.NVARCHAR ||
                        columnType == java.sql.Types.NCHAR || columnType == java.sql.Types.LONGNVARCHAR) {
                        // Character types - read as bytes to get raw GREEK encoded data
                        try {
                            // Read as bytes directly from ResultSet to preserve encoding
                            byte[] bytes = rs.getBytes(i);
                            if (bytes == null) {
                                row.put(columnName, JSONObject.NULL);
                            } else {
                                // Decode bytes as ISO-8859-7 (GREEK encoding) to get correct Greek text
                                String greekText = new String(bytes, "ISO-8859-7");
                                row.put(columnName, greekText);
                            }
                        } catch (Exception e) {
                            // Fallback: try getString and attempt conversion
                            try {
                                String strValue = rs.getString(i);
                                if (strValue == null) {
                                    row.put(columnName, JSONObject.NULL);
                                } else {
                                    // Get raw bytes using ISO-8859-1 (preserves byte values)
                                    byte[] bytes = strValue.getBytes("ISO-8859-1");
                                    // Decode as ISO-8859-7 (GREEK encoding)
                                    String fixed = new String(bytes, "ISO-8859-7");
                                    row.put(columnName, fixed);
                                }
                            } catch (Exception e2) {
                                // Last resort: use getString as-is
                                Object value = rs.getObject(i);
                                row.put(columnName, value != null ? value.toString() : JSONObject.NULL);
                            }
                        }
                    } else {
                        // Non-character types - use standard getObject
                        Object value = rs.getObject(i);
                        if (value == null) {
                            // Use JSONObject.NULL instead of null to avoid ambiguous method call
                            row.put(columnName, JSONObject.NULL);
                        } else if (value instanceof String) {
                            // String from non-character column - still might need conversion
                            String strValue = (String)value;
                            try {
                                byte[] bytes = strValue.getBytes("ISO-8859-1");
                                String fixed = new String(bytes, "ISO-8859-7");
                                row.put(columnName, fixed);
                            } catch (Exception e) {
                                row.put(columnName, strValue);
                            }
                        } else if (value instanceof byte[]) {
                            // BLOB/BINARY data - convert to string with UTF-8 encoding
                            try {
                                row.put(columnName, new String((byte[])value, "UTF-8"));
                            } catch (java.io.UnsupportedEncodingException e) {
                                row.put(columnName, new String((byte[])value));
                            }
                        } else if (value instanceof java.math.BigDecimal) {
                            // BigDecimal - convert to double to avoid precision issues
                            row.put(columnName, ((java.math.BigDecimal)value).doubleValue());
                        } else if (value instanceof java.sql.Date || value instanceof java.sql.Time || value instanceof java.sql.Timestamp) {
                            // SQL date/time types - convert to string
                            row.put(columnName, value.toString());
                        } else {
                            // Other types (numbers, dates, etc.)
                            row.put(columnName, value);
                        }
                    }
                }
                results.put(row);
            }
            
            JSONObject output = new JSONObject();
            output.put("success", true);
            output.put("rowsReturned", results.length());
            output.put("results", results);
            
            // Output JSON with UTF-8 encoding
            // Use PrintWriter with UTF-8 to ensure proper encoding for Greek characters
            java.io.PrintWriter pw = new java.io.PrintWriter(new java.io.OutputStreamWriter(System.out, java.nio.charset.StandardCharsets.UTF_8), true);
            pw.print(output.toString());
            pw.flush();
            
            rs.close();
            stmt.close();
            conn.close();
        } catch (Exception e) {
            JSONObject error = new JSONObject();
            error.put("success", false);
            error.put("error", e.getMessage());
            error.put("stack", getStackTrace(e));
            System.err.println(error.toString());
            System.exit(1);
        }
    }
    
    private static String getStackTrace(Exception e) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }
}