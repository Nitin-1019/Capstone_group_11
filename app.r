library(shiny)
library(plotly)

source("ui.R")

server <- function(input, output, session) {
}

shinyApp(
  ui = ui,
  server = server
)